import { BRUSH_MAX_RADIUS, BRUSH_MIN_RADIUS, MOUSE_MODE } from "./consts";
import {
    banControl,
    getEditType,
    getGlobalMap,
    getManager,
    getMouseIntersect,
    getTestTree,
    getUniforms,
    resetControl,
    traverseTileBFS,
} from "./core";
import { CommonStatus } from "./types";
import { InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from "./three-manager";

const status: CommonStatus = {
    isEdit: false,
    radius: 1,
    value: 1,
};

/** 已经放置的地块 */
const tiledSet = new Set<number>();

/** 剩余可用的 instanceid */
const leavedInstanceID = new Set<number>();

let treeMesh: InstancedMesh = null;

/** 单个视图下预估能看到的最大数量 */
const maxCount = 5;

export function createVegetationInstance() {
    // 假设第一个
    const tree = getTestTree().children[0] as Mesh;
    // 先简化一下模型
    const geo = getManager().simplifyMesh(tree.geometry, 0.98);
    treeMesh = new InstancedMesh(geo, tree.material, maxCount);

    const matrix = new Matrix4();
    // 先全部移动到无限远处，代表看不见
    const pos = new Vector3(100000, 0, 0);

    for (let i = 0; i < maxCount; i++) {
        leavedInstanceID.add(i);
        matrix.setPosition(pos.clone());
        treeMesh.setMatrixAt(i, matrix);
    }

    getManager().scene.add(treeMesh);
}

function isTheType() {
    return getEditType() === MOUSE_MODE.Vegetation;
}

export function vegetationPointerDown(e: PointerEvent) {
    if (!isTheType()) return;
    // 只考虑左键触发
    if (e.button !== 0) return;

    const { tileIndex } = getMouseIntersect();
    if (tileIndex == null) return;

    setStatus("isEdit", true);
    banControl();
}

export function vegetationPointerMove(e: PointerEvent) {
    if (!isTheType()) return;
    const { isEdit, radius } = status;
    const manager = getManager();
    const { tileIndex } = getMouseIntersect();
    if (tileIndex == null) return;

    const { uTileCount, uTileHoverArray } = getUniforms();
    const hoverIndexSet = new Set(traverseTileBFS(radius, tileIndex).flat());

    uTileCount.value = hoverIndexSet.size;

    const data = new Float32Array(500);

    // 第一个暂时保留，可能会用来存类型
    data[0] = 0;
    let i = 1;
    for (const tile of hoverIndexSet) {
        data[i] = tile;
        i++;
    }
    uTileHoverArray.value = data;

    if (isEdit) {
        // 更新内存 buffer
        const { tileZoneMap, zoneMeshMap, tileVertexMap } = getGlobalMap();

        for (const index of hoverIndexSet) {
            if (tiledSet.has(index)) continue;

            const mesh = zoneMeshMap.get(tileZoneMap.get(index));

            const geo = mesh.geometry;

            const posAttr = geo.getAttribute("position");

            const verts = tileVertexMap.get(index);
            const last = verts[verts.length - 1];

            const x = posAttr.getX(last);
            const y = posAttr.getY(last);
            const z = posAttr.getZ(last);

            // 加树子
            const pos = new Vector3(x, y, z);
            const quaternion = new Quaternion().setFromUnitVectors(
                new Vector3(0, 1, 0),
                pos.clone().normalize()
            );

            const matrix = new Matrix4();
            matrix.compose(pos, quaternion, new Vector3(3, 3, 3));

            const id = [...leavedInstanceID][0];
            treeMesh.setMatrixAt(id, matrix);
            // 用了这个id
            leavedInstanceID.delete(id);
            tiledSet.add(index);
        }

        // 需要更新 shader的 instanceMatrix
        treeMesh.instanceMatrix.needsUpdate = true;
        // 更改位置后必须更新，视锥检查是整个instanceMesh
        // 不是单个实例，不更新会导致视锥裁剪错误
        treeMesh.computeBoundingSphere();
    }
}

export function vegetationPointerUp(e: PointerEvent) {
    if (!isTheType()) return;
    resetControl();

    setStatus("isEdit", false);
}

export function getStatus() {
    return status;
}

export function setStatus<T extends keyof CommonStatus>(k: T, v: CommonStatus[T]) {
    if (v === status[k]) return;
    if (k === "radius") {
        let _v = v as number;
        if (_v < BRUSH_MIN_RADIUS) {
            _v = BRUSH_MIN_RADIUS;
        } else if (_v > BRUSH_MAX_RADIUS) {
            _v = BRUSH_MAX_RADIUS;
        }

        status.radius = _v;
    } else {
        status[k] = v;
    }
    // updateStatus();
}