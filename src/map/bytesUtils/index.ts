/**
 * @description 2023/7/19 增加多版本支持
 */

import {
    Border,
    Corner,
    IdModelMap,
    MapCorner,
    MapHeader,
    MapModelData,
    MapMountain,
    MapRiver,
    MapRiverTile,
    MapTile,
    MapTileProv,
    MapTreeData,
    MeshHeader,
    Tile,
} from "./types";

export class MapBytesUtils {
    private view: DataView;
    MAP_HEADER_BYTE_LENGTH = 20;
    private MAP_SINGLE_TILE_BYTE_LENGTH = 26;
    private MAP_SINGLE_CORNER_BYTE_LENGTH = 5;
    private RIVER_TILE_BYTE_LENGTH = 4;
    /** 跟踪有效长度，保存时把末尾无效的内存删除以节省空间 */
    validLength = 0;
    /** 数据版本 */
    mapVersion = 0;
    private modelMap: IdModelMap = null;
    /** modelmap 占据的字节长度 */
    modelMapByteLength = 0;

    /** 是否被修改 */
    modified = false;

    /** 从 9 版本开始插入到 map.bytes */
    modelMapSupportVersion = 9;

    constructor(buffer: ArrayBuffer) {
        this.validLength = buffer.byteLength;
        this.view = new DataView(buffer, 0, this.validLength);

        const { mapVersion } = this.getHeader();
        this.mapVersion = mapVersion;

        if (mapVersion >= 7) {
            // 增加一个宽度
            this.RIVER_TILE_BYTE_LENGTH = 5;
        }

        if (mapVersion >= 8) {
            // 增加一个体积光浓度
            this.MAP_SINGLE_TILE_BYTE_LENGTH = 30;
        }

        this.setModelMap();
    }

    getData() {
        return this.view;
    }

    getHeader() {
        const header: MapHeader = {
            mapVersion: this.view.getInt32(0, true),
            tilesCount: this.view.getInt32(4, true),
            cornersCount: this.view.getInt32(8, true),
            riversCount: this.view.getInt32(12, true),
            mountainsCount: this.view.getInt32(16, true),
        };

        return header;
    }

    setHeaderVersion(version: number) {
        this.view.setInt32(0, version, true);
    }

    private setModelMap() {
        if (this.mapVersion < this.modelMapSupportVersion) return;
        let offset = this.MAP_HEADER_BYTE_LENGTH;
        const originOffset = offset;
        let version: number = undefined;
        const tag = this.view.getUint8(offset);
        if (tag === 255) {
            version = this.view.getUint8(offset + 1);
            offset += 2;
        }

        const countTrees = this.view.getUint32(offset, true);
        offset += 4;

        const dataTrees: MapTreeData[] = [];

        for (let i = 0; i < countTrees; i++) {
            const id = this.view.getUint8(offset++);

            let length = 0;

            // 读取字节第一位
            const lengthByte = this.view.getUint8(offset++);
            if ((lengthByte & 0x80) !== 0) {
                // 最高位是1，继续读下一个字节
                const addByte = this.view.getUint8(offset++);
                length = ((lengthByte & 0x7f) << 8) | addByte;
            } else {
                // 最高位是0
                length = lengthByte;
            }

            let name = "";
            // 按照字节长度读取字符串
            for (let j = 0; j < length; j++) {
                name += String.fromCharCode(this.view.getUint8(offset++));
            }

            dataTrees.push({ id, name });
        }

        const countModel = this.view.getUint32(offset, true);
        offset += 4;

        const dataModels: MapModelData[] = [];

        for (let i = 0; i < countModel; i++) {
            let id = 0;
            if (tag === 255) {
                id = this.view.getInt16(offset, true);
                offset += 2;
            } else {
                id = this.view.getUint8(offset++);
            }

            let length = 0;
            // 读取字节第一位
            const lengthByte = this.view.getUint8(offset++);
            if ((lengthByte & 0x80) !== 0) {
                // 最高位是1，继续读下一个字节
                const addByte = this.view.getUint8(offset++);
                length = ((lengthByte & 0x7f) << 8) | addByte;
            } else {
                // 最高位是0
                length = lengthByte;
            }

            let name = "";
            // 按照字节长度读取字符串
            for (let j = 0; j < length; j++) {
                name += String.fromCharCode(this.view.getUint8(offset++));
            }

            dataModels.push({ id, name });
        }

        this.modelMapByteLength = offset - originOffset;

        this.modelMap = {
            tag,
            version,
            countTrees,
            dataTrees,
            countModel,
            dataModels,
        };
    }

    getModelMap() {
        return this.modelMap;
    }

    getTileByIndex(index: number) {
        const { mapVersion } = this.getHeader();

        const offset = this.MAP_HEADER_BYTE_LENGTH + this.modelMapByteLength + index * this.MAP_SINGLE_TILE_BYTE_LENGTH;

        const tile: MapTile = {
            elevation: this.view.getFloat32(offset + 4, true),
            waterElevation: this.view.getFloat32(offset + 8, true),
            temperature: this.view.getFloat32(offset + 12, true),
            moisture: this.view.getFloat32(offset + 16, true),
            type: this.view.getUint8(offset + 20),
            conv: this.view.getUint8(offset + 21),
            biomeDataType: this.view.getUint8(offset + 22),
            convDataType: this.view.getUint8(offset + 23),
            decoration: this.view.getInt16(offset + 24, true),
        };

        // 增加体积光浓度
        if (mapVersion >= 8) {
            tile.volumetricLightIntensity = this.view.getFloat32(offset + 26, true);
        }

        return tile;
    }

    /** 设置地块数据 */
    setTileByIndex(index: number, tile: Partial<MapTile>) {
        const { mapVersion } = this.getHeader();
        const offset = this.MAP_HEADER_BYTE_LENGTH + this.modelMapByteLength + index * this.MAP_SINGLE_TILE_BYTE_LENGTH;
        const { elevation, waterElevation, type, conv, decoration, biomeDataType, volumetricLightIntensity } = tile;

        if (elevation != undefined) {
            this.view.setFloat32(offset + 4, elevation, true);
        }

        if (waterElevation != undefined) {
            this.view.setFloat32(offset + 8, waterElevation, true);
        }

        if (type != undefined) {
            if (type >= 0 && type <= 255) {
                this.view.setUint8(offset + 20, type);
            }
        }

        if (conv >= 0) {
            this.view.setUint8(offset + 21, conv);
        }
        if (biomeDataType) {
            this.view.setUint8(offset + 22, biomeDataType);
        }

        if (decoration >= -1) {
            this.view.setInt16(offset + 24, decoration, true);
        }

        if (volumetricLightIntensity != undefined && mapVersion >= 8) {
            this.view.setFloat32(offset + 26, volumetricLightIntensity, true);
        }

        this.modified = true;
    }

    getAllTiles() {
        const tiles: MapTile[] = [];
        const { tilesCount } = this.getHeader();
        for (let i = 0; i < tilesCount; i++) {
            tiles.push(this.getTileByIndex(i));
        }

        return tiles;
    }

    getCornerByIndex(index: number) {
        const { tilesCount } = this.getHeader();

        const offset =
            this.MAP_HEADER_BYTE_LENGTH +
            this.modelMapByteLength +
            tilesCount * this.MAP_SINGLE_TILE_BYTE_LENGTH +
            index * this.MAP_SINGLE_CORNER_BYTE_LENGTH;

        const corner: MapCorner = {
            type: this.view.getUint8(offset + 4),
        };
        return corner;
    }

    getAllCorners() {
        const corners: MapCorner[] = [];
        const { cornersCount } = this.getHeader();

        for (let i = 0; i < cornersCount; i++) {
            corners.push(this.getCornerByIndex(i));
        }

        return corners;
    }

    /** 遍历获取单条河流 */
    getRiverByIndex(index: number) {
        const { tilesCount, cornersCount, riversCount } = this.getHeader();
        if (index < 0 || index > riversCount - 1) {
            return undefined;
        }

        let offset =
            this.MAP_HEADER_BYTE_LENGTH +
            this.modelMapByteLength +
            tilesCount * this.MAP_SINGLE_TILE_BYTE_LENGTH +
            cornersCount * this.MAP_SINGLE_CORNER_BYTE_LENGTH;

        for (let i = 0; i < index; i++) {
            const length = this.view.getInt32(offset + 4, true);

            const riverByteLength = 4 + 4 + this.RIVER_TILE_BYTE_LENGTH * length;

            offset += riverByteLength;
        }

        const length = this.view.getInt32(offset + 4, true);

        const tiles: MapRiverTile[] = [];

        offset += 4 + 4;

        for (let j = 0; j < length; j++) {
            const tile = this.view.getInt32(offset, true);
            offset += 4;
            const width = this.view.getUint8(offset);
            offset++;
            tiles.push({ tile, width });
        }

        const river: MapRiver = { length, tiles };

        return river;
    }

    /** 由于 river 变长，获取单独的river，不得不
     * 遍历所有的河流，考虑到效率，直接获取所有河流
     */
    getAllRivers() {
        const rivers: MapRiver[] = [];

        const { tilesCount, cornersCount, riversCount } = this.getHeader();

        let offset =
            this.MAP_HEADER_BYTE_LENGTH +
            this.modelMapByteLength +
            tilesCount * this.MAP_SINGLE_TILE_BYTE_LENGTH +
            cornersCount * this.MAP_SINGLE_CORNER_BYTE_LENGTH;

        for (let i = 0; i < riversCount; i++) {
            const length = this.view.getInt32(offset + 4, true);

            const tiles: MapRiverTile[] = [];

            offset += 4 + 4;

            for (let j = 0; j < length; j++) {
                const tile = this.view.getInt32(offset, true);
                offset += 4;
                const width = this.view.getUint8(offset);
                offset++;
                tiles.push({ tile, width });
            }

            rivers.push({ length, tiles });
        }

        return rivers;
    }

    /** 遍历获取单条山脉 */
    getMountainByIndex(index: number) {
        const { tilesCount, cornersCount, mountainsCount, riversCount, mapVersion } = this.getHeader();
        if (index < 0 || index > mountainsCount - 1) {
            return undefined;
        }

        let offset =
            this.MAP_HEADER_BYTE_LENGTH +
            this.modelMapByteLength +
            tilesCount * this.MAP_SINGLE_TILE_BYTE_LENGTH +
            cornersCount * this.MAP_SINGLE_CORNER_BYTE_LENGTH;

        // 偏移河流占字节
        for (let i = 0; i < riversCount; i++) {
            const riverLength = this.view.getInt32(offset + 4, true);
            const riverByteLength = 4 + 4 + this.RIVER_TILE_BYTE_LENGTH * riverLength;
            offset += riverByteLength;
        }

        for (let i = 0; i < index; i++) {
            const length = this.view.getInt32(offset + 4, true);
            const byteLength = 4 + 4 + 4 * length;
            offset += byteLength;
        }

        const length = this.view.getInt32(offset + 4, true);
        const tiles: number[] = [];
        for (let j = 0; j < length; j++) {
            tiles.push(this.view.getInt32(offset + 4 + 4 + j * 4, true));
        }

        const mountain: MapMountain = { length, tiles };

        return mountain;
    }

    /** 获取所有山脉 */
    getAllMountains() {
        const mountains: MapMountain[] = [];

        const { tilesCount, cornersCount, riversCount, mountainsCount, mapVersion } = this.getHeader();

        let offset =
            this.MAP_HEADER_BYTE_LENGTH +
            this.modelMapByteLength +
            tilesCount * this.MAP_SINGLE_TILE_BYTE_LENGTH +
            cornersCount * this.MAP_SINGLE_CORNER_BYTE_LENGTH;

        // 偏移河流占字节
        for (let i = 0; i < riversCount; i++) {
            const riverLength = this.view.getInt32(offset + 4, true);
            const riverByteLength = 4 + 4 + this.RIVER_TILE_BYTE_LENGTH * riverLength;
            offset += riverByteLength;
        }

        for (let i = 0; i < mountainsCount; i++) {
            const length = this.view.getInt32(offset + 4, true);

            const tiles: number[] = [];

            for (let j = 0; j < length; j++) {
                tiles.push(this.view.getInt32(offset + 4 + 4 + j * 4, true));
            }

            mountains.push({ length, tiles });
            offset += 4 + 4 + length * 4;
        }

        return mountains;
    }

    /** 获取所有山脉 */
    getAllMountainSet() {
        const mountains: Set<number>[] = [];

        const { tilesCount, cornersCount, riversCount, mountainsCount, mapVersion } = this.getHeader();

        let offset =
            this.MAP_HEADER_BYTE_LENGTH +
            this.modelMapByteLength +
            tilesCount * this.MAP_SINGLE_TILE_BYTE_LENGTH +
            cornersCount * this.MAP_SINGLE_CORNER_BYTE_LENGTH;

        // 偏移河流占字节
        for (let i = 0; i < riversCount; i++) {
            const riverLength = this.view.getInt32(offset + 4, true);
            const riverByteLength = 4 + 4 + this.RIVER_TILE_BYTE_LENGTH * riverLength;
            offset += riverByteLength;
        }

        for (let i = 0; i < mountainsCount; i++) {
            const length = this.view.getInt32(offset + 4, true);

            const tiles: Set<number> = new Set();

            for (let j = 0; j < length; j++) {
                tiles.add(this.view.getInt32(offset + 4 + 4 + j * 4, true));
            }

            mountains.push(tiles);
            offset += 4 + 4 + length * 4;
        }

        return mountains;
    }
}

const MESH_HEADER_BYTE_LENGTH = 20;
const MESH_SINGLE_CORNER_BYTE_LENGTH = 52;
const MESH_SINGLE_BORDER_BYTE_LENGTH = 32;
const MESH_SINGLE_FIVE_POLYGON_TILE_BYTE_LENGTH = 80;
const MESH_SINGLE_SIX_POLYGON_TILE_BYTE_LENGTH = 92;

export class MeshBytesUtils {
    private view: DataView;
    constructor(meshBuffer: ArrayBuffer) {
        this.view = new DataView(meshBuffer);
    }

    getHeader() {
        const header: MeshHeader = {
            version: this.view.getInt32(0, true),
            radius: this.view.getFloat32(4, true),
            cornersCount: this.view.getInt32(8, true),
            bordersCount: this.view.getInt32(12, true),
            tilesCount: this.view.getInt32(16, true),
        };

        return header;
    }

    getCornerByIndex(index: number) {
        const offset = MESH_HEADER_BYTE_LENGTH + index * MESH_SINGLE_CORNER_BYTE_LENGTH;
        const corner: Corner = {
            x: this.view.getFloat32(offset + 4, true),
            y: this.view.getFloat32(offset + 8, true),
            z: this.view.getFloat32(offset + 12, true),
            corners: [
                this.view.getInt32(offset + 16, true),
                this.view.getInt32(offset + 20, true),
                this.view.getInt32(offset + 24, true),
            ],
            borders: [
                this.view.getInt32(offset + 28, true),
                this.view.getInt32(offset + 32, true),
                this.view.getInt32(offset + 36, true),
            ],
            tiles: [
                this.view.getInt32(offset + 40, true),
                this.view.getInt32(offset + 44, true),
                this.view.getInt32(offset + 48, true),
            ],
        };
        return corner;
    }

    getAllCorners() {
        const corners: Corner[] = [];
        const { cornersCount } = this.getHeader();

        for (let i = 0; i < cornersCount; i++) {
            corners.push(this.getCornerByIndex(i));
        }

        return corners;
    }

    getBorderByIndex(index: number) {
        const { cornersCount } = this.getHeader();
        const offset =
            MESH_HEADER_BYTE_LENGTH +
            cornersCount * MESH_SINGLE_CORNER_BYTE_LENGTH +
            index * MESH_SINGLE_BORDER_BYTE_LENGTH;
        const border: Border = {
            x: this.view.getFloat32(offset + 4, true),
            y: this.view.getFloat32(offset + 8, true),
            z: this.view.getFloat32(offset + 12, true),
            corners: [this.view.getInt32(offset + 16, true), this.view.getInt32(offset + 20, true)],
            tiles: [this.view.getInt32(offset + 24, true), this.view.getInt32(offset + 28, true)],
        };

        return border;
    }

    getAllBorders() {
        const borders: Border[] = [];
        const { bordersCount } = this.getHeader();

        for (let i = 0; i < bordersCount; i++) {
            borders.push(this.getBorderByIndex(i));
        }

        return borders;
    }

    /** tile 由于可能是五边形或者六边形，边长，直接获取所有 tiles */
    getAllTiles() {
        const { cornersCount, bordersCount, tilesCount } = this.getHeader();
        let offset =
            MESH_HEADER_BYTE_LENGTH +
            cornersCount * MESH_SINGLE_CORNER_BYTE_LENGTH +
            bordersCount * MESH_SINGLE_BORDER_BYTE_LENGTH;

        const meshTiles: Tile[] = [];
        for (let i = 0; i < tilesCount; i++) {
            const borderCount = this.view.getInt32(offset + 16, true);
            const corners: number[] = [];
            const borders: number[] = [];
            const tiles: number[] = [];
            for (let j = 0; j < borderCount; j++) {
                corners.push(this.view.getInt32(offset + 20 + j * 4, true));
                borders.push(this.view.getInt32(offset + 20 + borderCount * 4 + j * 4, true));
                tiles.push(this.view.getInt32(offset + 20 + borderCount * 4 + borderCount * 4 + j * 4, true));
            }

            meshTiles.push({
                x: this.view.getFloat32(offset + 4, true),
                y: this.view.getFloat32(offset + 8, true),
                z: this.view.getFloat32(offset + 12, true),
                borderCount,
                corners,
                borders,
                tiles,
            });

            offset += 20 + borderCount * 4 + borderCount * 4 + borderCount * 4;
        }

        return meshTiles;
    }

    /** 遍历找到 tile，这个地方娶个巧，如果这里再遍历，cpu计算吃紧
     * 根据结果看 前12个是五边形，其他都是六边形
     */
    // getTileByIndex(index: number) {
    //     const { cornersCount, bordersCount, tilesCount } = this.getHeader();
    //     if (index + 1 > tilesCount) {
    //         return undefined;
    //     }

    //     let offset =
    //         MESH_HEADER_BYTE_LENGTH +
    //         cornersCount * MESH_SINGLE_CORNER_BYTE_LENGTH +
    //         bordersCount * MESH_SINGLE_BORDER_BYTE_LENGTH;

    //     for (let i = 0; i < index; i++) {
    //         const borderCount = this.view.getInt32(offset + 16, true);
    //         const tileByteLength =
    //             20 + borderCount * 4 + borderCount * 4 + borderCount * 4;
    //         offset += tileByteLength;
    //     }

    //     const borderCount = this.view.getInt32(offset + 16, true);
    //     const corners: number[] = [];
    //     const borders: number[] = [];
    //     const tiles: number[] = [];
    //     for (let j = 0; j < borderCount; j++) {
    //         corners.push(this.view.getInt32(offset + 20 + j * 4, true));
    //         borders.push(this.view.getInt32(offset + 20 + borderCount * 4 + j * 4, true));
    //         tiles.push(
    //             this.view.getInt32(
    //                 offset + 20 + borderCount * 4 + borderCount * 4 + j * 4,
    //                 true
    //             )
    //         );
    //     }

    //     const tile: Tile = {
    //         x: this.view.getFloat32(offset + 4, true),
    //         y: this.view.getFloat32(offset + 8, true),
    //         z: this.view.getFloat32(offset + 12, true),
    //         borderCount,
    //         corners,
    //         borders,
    //         tiles,
    //     };

    //     return tile;
    // }
    /** 这个地方娶个巧，如果这里再遍历，cpu计算吃紧
     * 根据结果看 前12个是五边形，其他都是六边形
     */
    getTileByIndex(index: number) {
        const { cornersCount, bordersCount, tilesCount } = this.getHeader();
        if (index + 1 > tilesCount) {
            return undefined;
        }

        let offset =
            MESH_HEADER_BYTE_LENGTH +
            cornersCount * MESH_SINGLE_CORNER_BYTE_LENGTH +
            bordersCount * MESH_SINGLE_BORDER_BYTE_LENGTH;

        let borderCount = 5;

        if (index < 12) {
            // 五边形
            offset += index * MESH_SINGLE_FIVE_POLYGON_TILE_BYTE_LENGTH;
        } else {
            offset +=
                12 * MESH_SINGLE_FIVE_POLYGON_TILE_BYTE_LENGTH +
                (index - 12) * MESH_SINGLE_SIX_POLYGON_TILE_BYTE_LENGTH;
            borderCount = 6;
        }

        const corners: number[] = [];
        const borders: number[] = [];
        const tiles: number[] = [];

        for (let j = 0; j < borderCount; j++) {
            corners.push(this.view.getInt32(offset + 20 + j * 4, true));
            borders.push(this.view.getInt32(offset + 20 + borderCount * 4 + j * 4, true));
            tiles.push(this.view.getInt32(offset + 20 + borderCount * 4 + borderCount * 4 + j * 4, true));
        }

        const tile: Tile = {
            x: this.view.getFloat32(offset + 4, true),
            y: this.view.getFloat32(offset + 8, true),
            z: this.view.getFloat32(offset + 12, true),
            borderCount,
            corners,
            borders,
            tiles,
        };

        return tile;
    }
}

export class ProvBytesUtils {
    private view: DataView;
    private MAP_TILE_PROV_BYTE_LENGTH = 8;
    modified = false;

    constructor(buffer: ArrayBuffer) {
        this.view = new DataView(buffer);
    }

    getData() {
        return this.view;
    }

    getProvByIndex(index: number) {
        const offset = index * this.MAP_TILE_PROV_BYTE_LENGTH;
        const tileProv: MapTileProv = {
            province: this.view.getInt32(offset, true),
            provinceDistance: this.view.getFloat32(offset + 4, true),
        };
        return tileProv;
    }

    setProvByIndex(index: number, prov: MapTileProv) {
        const offset = index * this.MAP_TILE_PROV_BYTE_LENGTH;
        const { province, provinceDistance } = prov;
        this.view.setInt32(offset, province, true);

        if (provinceDistance != undefined) {
            this.view.setFloat32(offset + 4, provinceDistance, true);
        }

        this.modified = true;
    }
}

export class IdModelMapBytesUtils {
    private view: DataView;
    private tag: number;
    modified = false;

    constructor(buffer: ArrayBuffer) {
        this.view = new DataView(buffer);
        this.tag = this.view.getUint8(0);
    }

    getData() {
        return this.view;
    }

    getCountTrees() {
        if (this.tag === 255) {
            // 新版本
            return this.view.getInt32(2, true);
        } else {
            // 旧版本
            return this.view.getInt32(0, true);
        }
    }

    getModelMap() {
        let version = undefined;
        let offset = 0;
        if (this.tag === 255) {
            version = this.view.getUint8(1);
            offset = 2;
        }

        const countTrees = this.view.getUint32(offset, true);
        offset += 4;

        const dataTrees: MapTreeData[] = [];
        for (let i = 0; i < countTrees; i++) {
            const id = this.view.getUint8(offset++);

            let length = 0;

            // 读取字节第一位
            const lengthByte = this.view.getUint8(offset++);
            if ((lengthByte & 0x80) !== 0) {
                // 最高位是1，继续读下一个字节
                const addByte = this.view.getUint8(offset++);
                length = ((lengthByte & 0x7f) << 8) | addByte;
            } else {
                // 最高位是0
                length = lengthByte;
            }

            let name = "";
            // 按照字节长度读取字符串
            for (let j = 0; j < length; j++) {
                name += String.fromCharCode(this.view.getUint8(offset++));
            }

            dataTrees.push({ id, name });
        }

        const countModel = this.view.getUint32(offset, true);
        offset += 4;

        const dataModels: MapModelData[] = [];
        for (let i = 0; i < countModel; i++) {
            let id = 0;
            if (this.tag === 255) {
                id = this.view.getInt16(offset, true);
                offset += 2;
            } else {
                id = this.view.getUint8(offset++);
            }

            let length = 0;
            // 读取字节第一位
            const lengthByte = this.view.getUint8(offset++);
            if ((lengthByte & 0x80) !== 0) {
                // 最高位是1，继续读下一个字节
                const addByte = this.view.getUint8(offset++);
                length = ((lengthByte & 0x7f) << 8) | addByte;
            } else {
                // 最高位是0
                length = lengthByte;
            }

            let name = "";
            // 按照字节长度读取字符串
            for (let j = 0; j < length; j++) {
                name += String.fromCharCode(this.view.getUint8(offset++));
            }

            dataModels.push({ id, name });
        }

        const idModelMap: IdModelMap = {
            tag: this.tag,
            version,
            countTrees,
            dataTrees,
            countModel,
            dataModels,
        };

        return idModelMap;
    }
}
