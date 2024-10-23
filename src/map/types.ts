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
