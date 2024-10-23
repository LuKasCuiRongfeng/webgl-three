export type MeshHeader = {
    version: number;
    radius: number;
    cornersCount: number;
    bordersCount: number;
    tilesCount: number;
};

export type Corner = {
    size?: number;
    x: number;
    y: number;
    z: number;
    corners?: number[];
    borders?: number[];
    tiles?: number[];
};

export type Border = {
    size?: number;
    x?: number;
    y?: number;
    z?: number;
    corners?: number[];
    tiles: number[];
};

export type Tile = {
    size?: number;
    x: number;
    y: number;
    z: number;
    borderCount?: number;
    corners: number[];
    borders: number[];
    tiles: number[];
};

export interface Mesh {
    header: MeshHeader;
    corners: Corner[];
    borders: Border[];
    tiles: Tile[];
}

export type MapHeader = {
    mapVersion: number;
    tilesCount: number;
    cornersCount: number;
    riversCount: number;
    mountainsCount: number;
};

export type MapTile = {
    size?: number;
    /** 地面高度 */
    elevation: number;
    /** 水体高度 */
    waterElevation: number;
    /** 温度 */
    temperature: number;
    /** 湿度 */
    moisture: number;
    /** 格子贴图类型 byte 一个字节 对应 tile表里的 textureid */
    type: number;
    /** 显示资源类型，对应 idModelMap 里的 Treedata 数组索引 */
    conv: number;
    /** 气候大类型，对应 climate 表的 value，不同气候大类型里的子类型可能有交叉 */
    biomeDataType: number;
    /** 原始资源数据类型，等同于 conv */
    convDataType: number;
    /** 装饰（城市/建筑）模型类型 short 占两个字节， 对应 idModelMap 里的 modeldata 数组索引  */
    decoration: number;
    /** 体积光浓度 v >= 8 */
    volumetricLightIntensity?: number;
};

// v >= 7
export type MapRiverTile = {
    tile: number;
    /** 宽度 一个字节 */
    width: number;
};

export type MapRiver = {
    size?: number;
    /** 长度 */
    length: number;
    /** 河流的格子 */
    tiles: MapRiverTile[];
};

export type MapMountain = {
    size?: number;
    /** 长度 */
    length: number;
    /** 山脉的格子 */
    tiles: number[];
};

export type MapCorner = {
    size?: number;
    /** 悬崖贴图类型 */
    type: number;
};

export interface Map {
    header: MapHeader;
    tiles: MapTile[];
    corners: MapCorner[];
    rivers: MapRiver[];
}

export type MapTileProv = {
    /** 所属省份，0表示无所属，刷省份时注自己分配id，id尽量从1开始连续 */
    province: number;
    /** 到省份边界的距离，请自行计算，边界上为0，每靠内一圈该值+1 */
    provinceDistance?: number;
};

///////// idModelMap ///////////////
export type MapTreeData = {
    /** byte 对应数组索引 和 mapbytes里的 byte conv, 也等于校正后数据库索引 + 1， 0表示空 */
    id: number;
    /**
     * 可变长编码
     *
     * 对应 model_asstests 里的 id，读取时如果字节最高位是1，就需要按照相同的方式继续读取下一个字节，直到遇到
     * 最高位是 0，则不继续读，然后把这些字节作为字符串长度
     * 比如 01111111 10101010 第一个字节最高位是0，那就只需读第一个字节作为字符串长度
     * 10101010 01110001 10010101 第一个字节最高位是1，还需继续找第二个字节，第二个字节最高位为0，停止，那前2个字节作为字符串长度
     */
    name: string;
};

export type MapModelData = {
    /** 对应数组索引和 mapbytes里的  short decoration,也等于校正后的数据库索引，老版本 是 byte 类型，新版本是 short类型，-1表示空 */
    id: number;
    /** 对应 model_asstests 里的 id */
    name: string;
};

export type IdModelMap = {
    /**
     * byte tag = 255 新版本，有 tag 和 version 字段，其他值是旧版本，无 tag 和 version 字段
     *
     * 读取的时候先尝试读取第一个字节 如果读出来是 255， 则是新版本，则重新读取tag 和 version
     * 如果不是255，则是旧版本，就没有 tag version，直接从 countTrees int32 开始读
     */
    tag?: number;
    /** byte 新版本有，旧版本没有 version */
    version?: number;
    /** int32 树类型数量 */
    countTrees: number;
    dataTrees: MapTreeData[];
    countModel: number;
    dataModels: MapModelData[];
};
