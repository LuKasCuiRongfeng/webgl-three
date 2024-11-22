import { BRUSH_MAX_RADIUS, BRUSH_MIN_RADIUS, MOUSE_MODE } from "./consts";
import {
    banControl,
    getEditType,
    getGlobalMap,
    getIntersectOfMesh,
    getManager,
    getUniforms,
    resetControl,
} from "./core";
import { CommonStatus, LayerStyle } from "./types";
import { BufferGeometry, Mesh, MeshBVH } from "./three-manager";

const status: CommonStatus = {
    isEdit: false,
    value: 1,
};

const geoMap: Map<number, BufferGeometry> = new Map();

const moutained = new Set<number>();

function isTheType() {
    return getEditType() === MOUSE_MODE.Mountain;
}

export function mountainPointerDown(e: PointerEvent) {
    if (!isTheType()) return;
    // 只考虑左键触发
    if (e.button !== 0) return;

    const manager = getManager();
    const { tileIndex } = getIntersectOfMesh(manager.getCanvasNDC(e)) || {};
    if (tileIndex == null) return;

    setStatus("isEdit", true);
    banControl();
}

export function mountainPointerMove(e: PointerEvent) {
    if (!isTheType()) return;
    const { isEdit } = status;
    const manager = getManager();
    const { tileIndex } = getIntersectOfMesh(manager.getCanvasNDC(e)) || {};
    if (tileIndex == null) return;

    const { uTileCount, uTileHoverArray } = getUniforms();
    const { tileVertexMap, tileZoneMap, zoneMeshMap } = getGlobalMap();

    uTileCount.value = 1;

    const verts = tileVertexMap.get(tileIndex);
    const lastVert = verts[verts.length - 1];

    const data = new Float32Array(500);
    data[0] = tileIndex;
    // 最后一个顶点索引
    data[1] = lastVert;
    uTileHoverArray.value = data;

    if (isEdit && !moutained.has(tileIndex)) {
        const mesh = zoneMeshMap.get(tileZoneMap.get(tileIndex));
        const geo = mesh.geometry;

        if (!geoMap.has(mesh.id)) {
            geoMap.set(mesh.id, geo);
        }

        const posAttr = geo.getAttribute("position");
        const noramlAttr = geo.getAttribute("normal");

        const i = lastVert;

        // 修改顶点数据
        const x = posAttr.getX(i) + 3 * noramlAttr.getX(i);
        const y = posAttr.getY(i) + 3 * noramlAttr.getY(i);
        const z = posAttr.getZ(i) + 3 * noramlAttr.getZ(i);

        posAttr.setX(i, x);
        posAttr.setY(i, y);
        posAttr.setZ(i, z);

        moutained.add(tileIndex);

        posAttr.needsUpdate = true;
    }
}

export function mountainPointerUp(e: PointerEvent) {
    if (!isTheType()) return;
    resetControl();
    setStatus("isEdit", false);

    udpateMeshBvh();
    geoMap.clear();
}

function udpateMeshBvh() {
    for (const [_, geo] of geoMap) {
        geo.boundsTree = new MeshBVH(geo);
    }
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
