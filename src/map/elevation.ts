import { BRUSH_MAX_RADIUS, BRUSH_MIN_RADIUS, MOUSE_MODE } from "./consts";
import {
    banControl,
    getEditType,
    getGlobalBytesUtils,
    getGlobalMap,
    getIntersectOfMesh,
    getManager,
    getUniforms,
    resetControl,
    traverseTileBFS,
} from "./core";
import { CommonStatus } from "./types";
import { BufferGeometry, MeshBVH } from "./three-manager";

const status: CommonStatus = {
    isEdit: false,
    radius: 1,
    value: 1,
};

const geoMap: Map<number, BufferGeometry> = new Map();

function isTheType() {
    return getEditType() === MOUSE_MODE.Elevation;
}

export function elevationPointerDown(e: PointerEvent) {
    if (!isTheType()) return;
    // 只考虑左键触发
    if (e.button !== 0) return;

    const manager = getManager();
    const { tileIndex } = getIntersectOfMesh(manager.getCanvasNDC(e)) || {};
    if (tileIndex == null) return;

    setStatus("isEdit", true);
    banControl();
}

export function elevationPointerMove(e: PointerEvent) {
    if (!isTheType()) return;
    const { isEdit, radius, value } = status;
    const manager = getManager();
    const { tileIndex } = getIntersectOfMesh(manager.getCanvasNDC(e)) || {};
    if (tileIndex == null) return;

    const { uTileCount, uTileHoverArray } = getUniforms();
    const hoverIndexSet = new Set(traverseTileBFS(radius, tileIndex).flat());

    uTileCount.value = hoverIndexSet.size;

    const data = new Float32Array(500);

    // 第一个存海拔
    data[0] = value;
    let i = 1;
    for (const tile of hoverIndexSet) {
        data[i] = tile;
        i++;
    }
    uTileHoverArray.value = data;

    if (isEdit) {
        // 更新内存 buffer
        const { mapBytesUtils } = getGlobalBytesUtils();
        const { tileZoneMap, zoneMeshMap, tileVertexMap } = getGlobalMap();

        for (const index of hoverIndexSet) {
            mapBytesUtils.setTileByIndex(index, { elevation: value });

            const mesh = zoneMeshMap.get(tileZoneMap.get(index));

            const geo = mesh.geometry;

            if (!geoMap.has(mesh.id)) {
                geoMap.set(mesh.id, geo);
            }

            const posAttr = geo.getAttribute("position");
            const noramlAttr = geo.getAttribute("normal");
            const aEleAttr = geo.getAttribute("aEle");
            const aWaterEleAttr = geo.getAttribute("aWaterEle");

            const verts = tileVertexMap.get(index);
            verts.forEach((i, _i) => {
                const ele = aEleAttr.getX(i);
                const waterEle = aWaterEleAttr.getX(i);
                const altitude = Math.max(ele, waterEle);
                const newAltitude = Math.max(waterEle, value);
                const diff = newAltitude - altitude;

                // 修改顶点数据
                const x = posAttr.getX(i) + diff * noramlAttr.getX(i);
                const y = posAttr.getY(i) + diff * noramlAttr.getY(i);
                const z = posAttr.getZ(i) + diff * noramlAttr.getZ(i);

                posAttr.setX(i, x);
                posAttr.setY(i, y);
                posAttr.setZ(i, z);

                aEleAttr.setX(i, value);
            });

            posAttr.needsUpdate = true;
            aEleAttr.needsUpdate = true;
        }
    }
}

export function elevationPointerUp(e: PointerEvent) {
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
