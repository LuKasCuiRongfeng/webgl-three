import { BRUSH_HOVER_COLOR, BRUSH_MAX_RADIUS, BRUSH_MIN_RADIUS, MOUSE_MODE } from "./consts";
import {
    banControl,
    createMask,
    DataTextureConfig,
    getEditType,
    getGlobalBytesUtils,
    getGlobalMap,
    getIntersectOfMesh,
    getManager,
    getTestTree,
    getUniforms,
    resetControl,
    traverseTileBFS,
} from "./core";
import { CommonStatus, LayerStyle } from "./types";
import { BufferGeometry, InstancedMesh, Matrix4, Mesh, MeshBVH, Quaternion, Vector3 } from "./three-manager";

const status: CommonStatus = {
    isEdit: false,
    radius: 1,
    value: 1,
};

/** mask所在的中心格子，方便标记遮罩层，以及避免重复渲染 */
let tempMaskTile: number = undefined;

/** 地块遮罩，关联 tempMaskTile */
let tempMask: Mesh = null;

/** 当前分区内 tileindex -> instance id */
const tileInstanceMap = new Map<number, number>();

/** 剩余可用的 instanceid */
const leavedInstanceID = new Set<number>();

let treeMesh: InstancedMesh = null;

export function createVegetationInstance() {
    // 预估每个分区放这么多
    const count = 1000;
    // 假设第一个
    const tree = getTestTree().children[0] as Mesh;
    treeMesh = new InstancedMesh(tree.geometry, tree.material, count);
    const matrix = new Matrix4()
    // 先全部移动到无限远处，代表看不见
    const pos = new Vector3(100000, 0, 0)

    for (let i = 0; i < count; i++) {
        leavedInstanceID.add(i);
        matrix.setPosition(pos.clone())
        treeMesh.setMatrixAt(i, matrix)
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

    const manager = getManager();
    const { tileIndex } = getIntersectOfMesh(manager.getCanvasNDC(e)) || {};
    if (tileIndex == null) return;

    setStatus("isEdit", true);
    banControl();
}

export function vegetationPointerMove(e: PointerEvent) {
    if (!isTheType()) return;
    const { isEdit, radius, value } = status;
    const manager = getManager();
    const { tileIndex } = getIntersectOfMesh(manager.getCanvasNDC(e)) || {};
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
        const { tileZoneMap, zoneMeshMap, zoneMeshTileVertexMap } = getGlobalMap();

        for (const index of hoverIndexSet) {
            if (tileInstanceMap.has(index)) continue;

            const mesh = zoneMeshMap.get(tileZoneMap.get(index));

            const geo = mesh.geometry;

            const posAttr = geo.getAttribute("position");

            const verts = zoneMeshTileVertexMap.get(index);
            const last = verts[verts.length - 1];

            const x = posAttr.getX(last);
            const y = posAttr.getY(last);
            const z = posAttr.getZ(last);

            // 加树子
            const pos = new Vector3(x, y, z);
            const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), pos.clone().normalize());

            const matrix = new Matrix4();
            matrix.compose(pos, quaternion, new Vector3(3, 3, 3));

            const id = [...leavedInstanceID][0];
            console.log("id", id)
            treeMesh.setMatrixAt(id, matrix);
            // 用了这个id
            leavedInstanceID.delete(id);
            tileInstanceMap.set(index, id);
        }

        // 需要更新 shader的 instanceMatrix
        treeMesh.instanceMatrix.needsUpdate = true
        // 更改位置后必须更新，视锥检查是整个instanceMesh
        // 不是单个实例，不更新会导致视锥裁剪错误
        treeMesh.computeBoundingSphere()
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

/** 销毁格子遮罩 */
function destroyTileMask() {
    if (!tempMask) return;

    tempMask.removeFromParent();
    tempMask.geometry.dispose();
    // @ts-ignore
    tempMask.material.dispose();

    tempMask = null;
    tempMaskTile = undefined;
}

/**
 * 创建格子遮罩
 * @param tileIndices 创建遮罩的格子
 * @param tileIndex 遮罩中心，用于避免重复计算，通常取鼠标所在的位置
 * @param style 遮罩样式
 * @param detail 细粒度控制样式
 * @param force 强制更新
 */
function createTileMask(
    tileIndices: Set<number>,
    tileIndex: number,
    style: LayerStyle,
    detail?: Record<number, LayerStyle>,
    force?: boolean
) {
    // 检查一下，避免在同一个格子重复生成遮罩
    if (tileIndex === tempMaskTile && !force) return;

    // 销毁旧的遮罩
    destroyTileMask();

    const { color } = style;

    const { mask } = createMask(tileIndices, { color }, detail);
    if (!mask) return;

    tempMask = mask;

    tempMaskTile = tileIndex;

    const manager = getManager();

    manager.scene.add(tempMask);
}
