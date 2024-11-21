import { LineSegments } from "./three-manager";

/** uv 坐标 */
export type UV = [number, number];

/** [r, g, b, a] 0~1之间的浮点数 */
export type XColor = [number, number, number, number];

/** [r, g, b] */
export type XColor2 = [number, number, number];

/** 用于空间坐标系，右手坐标系 */
export type Coordinate = { x: number; y: number; z: number };

/** 用于屏幕坐标系和设备坐标系 */
export type Coordinate2D = { x: number; y: number };

/** 经纬度坐标 */
export type LatLng = { lat: number; lng: number };

/** 地图初始化状态 */
export type MapInitStatus = {
    checking?: boolean;
    checkFile?: string;
    error?: string;
    loadPercent?: number;
    /** 初始化阶段，分三个阶段：大地图加载阶段，小地图加载阶段，和计算孤立区域阶段 */
    stage?:
        | "big_map"
        | "mini_map"
        | "calc_isolated"
        | "process_tile"
        | "draw_layer"
        | "render_province"
        | "render_sea"
        | "render_altitude"
        | "render_water_elevation"
        | "render_river";
    /** 初始化合并进度 */
    combinePercent?: number;
};

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 分区 ----------------------------
/** 地理坐标分区
 * 采用东西经度从本初子午线 0° 开始，每隔开一定经度划一个经度大区，
 * 从 0 ~ 360 依次标为 1 2 3 4 5 ...
 * 在每个经度大区里，从极点 -90° 开始在南北纬隔开一定经度划一个纬度大区，
 * const -90~90 依次标为 1 2 3 4 5 ...
 * 如何定位一个区？采用二元数定位，并按照先纬度后经度的惯例
 * 比如 [1, 1]
 * 按照惯例，先纬度后经度
 */
export type GISZone = [number, number];

/** key = JSON.stringify(GISZone), Map里直接用GISZone有问题，转一下，在极地区域做了特殊处理
 * 北极 用 N，南极用 S
 */
export type GISZoneKey = string;

/** 同时适用多个分区组合的大分区，注意把极地分区合并成一个小分区 */
export type GISZoneMap = Record<GISZoneKey, GISZone>;

/** 代表当前可显示的分区，可能有一个或多个 */
export type GISZones = Map<GISZoneKey, GISZone>;

/** 在分区内的格子索引 key = JSON.stringify(GISZone) */
export type GISZoneTileIndicesMap = Map<GISZoneKey, number[]>;

/** 储存多边形面数，由于有可能这个区域会包含五边形
 * 单个格子可能会有3个或则4个面，导致faceindex和tileindex
 * 映射出问题
 * key = JSON.stringify(GISZone)
 */
export type GISZoneFacesMap = Map<GISZoneKey, number[]>;

/** 映射每个分区的合并边界 */
export type GISZoneBordersMap = Map<GISZoneKey, LineSegments>;

export type CommonStatus = {
    typeUUID?: string;
    initUUID?: string;
    /** 对于没有 uuid的，作为备选 */
    selectedId?: number;
    isEdit?: boolean;
    radius?: number;
    /** 用作基础数据，比如海拔值，水面高度值 */
    value?: number;
    isDelete?: boolean;
    isAdd?: boolean;
};

/** 定义图层样式 */
export type LayerStyle = {
    /** 遮罩颜色 */
    color?: XColor;
    /** 线颜色，16进制数字 */
    lineColor?: number;
    /** 线宽，大于0 有效 */
    lineWidth?: number;
};

export type GeoBounds = {
    lonMin: number;
    lonMax: number;
    latMin: number;
    latMax: number;
    center?: LatLng;
};

export type ZoneData = {
    zone: GISZone,
    bounds: GeoBounds
}
