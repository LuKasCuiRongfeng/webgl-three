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
    getUniforms,
    resetControl,
    traverseTileBFS,
} from "./core";
import { CommonStatus, LayerStyle } from "./types";
import { BufferGeometry, Matrix4, Mesh, MeshBVH } from "./three-manager";

const status: CommonStatus = {
    isEdit: false,
    value: 1,
};

/** mask所在的中心格子，方便标记遮罩层，以及避免重复渲染 */
let tempMaskTile: number = undefined;

/** 地块遮罩，关联 tempMaskTile */
let tempMask: Mesh = null;

const geoMap: Map<number, BufferGeometry> = new Map();

const moutained = new Set<number>()

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

    const { uDataTexture, uTileCount, uMouseMode, uTileHoverArray } = getUniforms();
    const { zoneMeshTileVertexMap } = getGlobalMap();

    uTileCount.value = 1;

    const verts = zoneMeshTileVertexMap.get(tileIndex);

    const data = new Float32Array(500);
    data[0] = tileIndex;
    // 最后一个顶点索引
    data[1] = verts[verts.length - 1];
    uTileHoverArray.value = data;

    // const dataTexture = uDataTexture.value
    // const width = DataTextureConfig.width

    // const size = width * hoverIndexSet.size * 4
    // const data = new Float32Array(size);

    // let offset = 0

    // for (const tile of hoverIndexSet) {
    //     const { corners } = meshBytesUtils.getTileByIndex(tile)
    //     const verts = zoneMeshTileVertexMap.get(tile)

    //     // 第一个存 tileid
    //     data[offset] = tile
    //     // 第二个存 edge count
    //     data[offset + 1] = corners.length
    //     // 之后依次存顶点 索引
    //     verts.forEach((v, i) => {
    //         data[offset + 1 + i + 1] = v
    //     })

    //     offset += width * 4
    // }
    // // @ts-ignore
    // dataTexture.image.data = data
    // dataTexture.needsUpdate = true

    if (isEdit && !moutained.has(tileIndex)) {
        const { tileZoneMap, zoneMeshMap, zoneMeshTileVertexMap } = getGlobalMap();
        const mesh = zoneMeshMap.get(tileZoneMap.get(tileIndex));
        const geo = mesh.geometry;

        if (!geoMap.has(mesh.id)) {
            geoMap.set(mesh.id, geo);
        }

        const posAttr = geo.getAttribute("position");
        const noramlAttr = geo.getAttribute("normal");
        const verts = zoneMeshTileVertexMap.get(tileIndex);

        const i = verts[verts.length - 1];

        // 修改顶点数据
        const x = posAttr.getX(i) + 3 * noramlAttr.getX(i);
        const y = posAttr.getY(i) + 3 * noramlAttr.getY(i);
        const z = posAttr.getZ(i) + 3 * noramlAttr.getZ(i);

        posAttr.setX(i, x);
        posAttr.setY(i, y);
        posAttr.setZ(i, z);

        moutained.add(tileIndex)

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
