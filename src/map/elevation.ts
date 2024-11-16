import { BRUSH_HOVER_COLOR, BRUSH_MAX_RADIUS, BRUSH_MIN_RADIUS } from "./consts";
import { banControl, createMask, DataTextureConfig, getGlobalBytesUtils, getGlobalMap, getIntersectOfMesh, getManager, getUniforms, resetControl, traverseTileBFS } from "./core";
import { CommonStatus, LayerStyle } from "./types";
import { Matrix4, Mesh } from "./three-manager"

const status: CommonStatus = {
    isEdit: false,
    radius: 10,
    value: 1,
};

/** mask所在的中心格子，方便标记遮罩层，以及避免重复渲染 */
let tempMaskTile: number = undefined;

/** 地块遮罩，关联 tempMaskTile */
let tempMask: Mesh = null;

export function elevationPointerDown(e: PointerEvent) {
    // 只考虑左键触发
    if (e.button !== 0) return;

    const manager = getManager()
    const { tileIndex } = getIntersectOfMesh(manager.getCanvasNDC(e)) || {}
    if (tileIndex == null) return

    setStatus("isEdit", true);
    banControl()
}

export function elevationPointerMove(e: PointerEvent) {
    const { isEdit, radius, value } = status;
    const manager = getManager()
    const { tileIndex } = getIntersectOfMesh(manager.getCanvasNDC(e)) || {}
    if (tileIndex == null) return

    const { uDataTexture, uTileCount, uMouseMode, uTile } = getUniforms()
    const hoverIndexSet = new Set(traverseTileBFS(radius, tileIndex).flat());

    uTileCount.value = hoverIndexSet.size;
    uMouseMode.value = 0

    const data = new Float32Array(500)

    let i = 0;
    for (const tile of hoverIndexSet) {
        data[i] = tile
        i++
    }
    uTile.value = data

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

    // console.log(dataTexture.image.data)
    // createTileMask(hoverIndexSet, tileIndex, { color: BRUSH_HOVER_COLOR });
}

export function elevationPointerUp(e: PointerEvent) {
    resetControl()
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