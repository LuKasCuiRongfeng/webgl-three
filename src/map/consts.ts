import { GISZone, LatLng, MapInitStatus, XColor } from "./types";

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 通用 ----------------------------
/** 通用透明度 */
export const GLOBAL_ALPHA = 1;

/** 通用高亮透明度 */
export const GLOBAL_HIGHTLIGHT_ALPHA = 1;

/** 大地图通用格子数量 */
export const BIG_MAP_TILECOUNT = 1600002;

/** 被视为小地图的临界值 */
export const MAP_MULTIPLE_THRESH = 3;

/** 地图初始化状态 */
export const MAP_INIT_STATUS: MapInitStatus = {
    checking: false,
    checkFile: "",
    error: "",
    loadPercent: 0,
    stage: "process_tile",
};

/** 假设的多边形边长 */
export const POLYGON_SIDE_LENGTH = 1;

/** 小地图经线步长 */
export const MINIMAP_LONGITUDE_STEP = 10;

/** 小地图纬线步长 */
export const MINIMAP_LATITUDE_STEP = 10;

/** 允许的地块颜色 */
export const ALLOWED_TILE_COLOR: XColor = [0, 1, 0, 1];

export const ALLOWED_TILE_WARN_COLOR: XColor = [1, 1, 0, 1];

export const ALLOWED_TILE_ALPHA_COLOR: XColor = [0, 1, 0, 0.6];

export const ALLOWED_TILE_WARN_ALPHA_COLOR: XColor = [1, 1, 0, 0.6];

/** 禁止的地块颜色 */
export const FORBIDDEN_TILE_COLOR: XColor = [1, 0, 0, 1];
export const FORBIDDEN_TILE_ALPHA_COLOR: XColor = [1, 0, 0, 0.6];

/** 高亮地块颜色 */
export const HIGHTLIGHT_TILE_COLOR: XColor = [1, 1, 0, 1];

/** BASE 图层等级 */
export const RENDER_ORDER_BASE = 2;

/** 地形 图层等级 */
export const RENDER_ORDER_TERRIAN = 1;

/** height 图层等级 */
export const RENDER_ORDER_HEIGHT = 3;

/** PROVINCE 图层等级 */
export const RENDER_ORDER_PROVINCE = 5;

export const RENDER_ORDER_WATER_ELEVATION = 6;

export const RENDER_ORDER_ELEVATION = 7;

/** RIVER 图层等级 */
export const RENDER_ORDER_RIVER = 9;

/** 资源 图层等级 */
export const RENDER_ORDER_RESOURCE = 10;

/** 军队 图层等级 */
export const RENDER_ORDER_MILITARY = 10;

/** 建筑地图层级 */
export const RENDER_ORDER_BUILD = 10;

/** 路点地图层级 */
export const RENDER_ORDER_WAYPOINT = 10;

/** 暂时的遮罩层级 */
export const RENDER_ORDER_TEMP_MASK = 20;

/** 线的等级，线一般放在最上面 */
export const RENDER_ORDER_TOP_LINE = 21;

/** FOG地图层级 */
export const RENDER_ORDER_FOG = 23;

/** 被判定为悬崖的下限值 */
export const CLIFF_LOWER = 2;

/** 被判定为平原的上限 */
export const PLAIN_UPPER = 1;

/** 被判定为连通的上限 */
export const CONNECTION_UPPER = 1;

/** 悬崖边的宽度 */
export const CLIFF_EDGE_LINEWIDTH = 6;

/** 悬崖边的颜色 */
export const CLIFF_EDGE_COLOR = 0xff0000;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 地块和边界 ----------------------------
/** 正常格子海洋颜色 */
export const TILE_OCEAN_COLOR: XColor = [1, 1, 1, 1];

/** 正常格子海洋带透明度颜色 */
export const TILE_OCEAN_ALPHA_COLOR: XColor = [0, 0, 0, 0];

/** 小地图正常格子海洋颜色 */
export const TILE_MINI_OCEAN_COLOR: XColor = [3 / 255, 137 / 255, 210 / 255, 1];

/** 正常格子陆地颜色 */
export const TILE_LAND_COLOR: XColor = [0.8, 0.8, 0.8, 1];

/** 正常格子陆地带透明度颜色 */
export const TILE_LAND_ALPHA_COLOR: XColor = [0, 0, 0, 0];

/** 小地图正常格子陆地颜色 */
export const TILE_MINI_LAND_COLOR: XColor = [0.2, 0.2, 0.2, 1];

/** 通用地块边界颜色 */
export const TILE_EDGE_COLOR: XColor = [64 / 255, 56 / 255, 12 / 255, 1];

/** 通用地块边界颜色 16进制类型 */
export const TILE_EDGE_HEX_COLOR = 0x645612;

/** 图标网格尺寸 */
export const ICON_GIRD_SIZE = 40;

/** 图标列表尺寸 */
export const ICON_LIST_SIZE = 24;

/** 合并进度大地图权重 */
export const COMBINE_BIGMAP_WEIGHT = 0.5;

/** 合并进度小地图权重 */
export const COMBINE_MINIMAP_WEIGHT = 0;

// 加载权重
export const COMBINE_ISOLATED_WEIGHT = 0.05;
export const COMBINE_PROCESS_TILE_WEIGHT = 0.2;
export const COMBINE_RENDER_LAYER_WEIGHT = 0.4;
export const COMBINE_RENDER_PROVINCE_WEIGHT = 0.1;
export const COMBINE_RENDER_SEA_WEIGHT = 0.1;
export const COMBINE_RENDER_ELEVATION_WEIGHT = 0.1;
export const COMBINE_RENDER_WATER_ELEVATION_WEIGHT = 0;
export const COMBINE_RENDER_RIVER_WEIGHT = 0.05;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 灯光 ----------------------------
/** 环境光颜色 */
export const AMBIENT_LIGHT_COLOR = 0xffffff;

/** 方向光颜色 */
export const DIRECTIONAL_LIGHT_COLOR = 0xffffff;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 地球 ----------------------------
/** 地球颜色 */
export const EARTH_COLOR = 0xffffff;

/** 宽度分块 */
export const WIDTH_SEGMENTS = 50;

/** 高度分块 */
export const HEIGHT_SEGMENTS = 50;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 鼠标 ----------------------------
/** 判断用户正在点击的最大时间限度 */
export const MAX_CLICKING_TIME = 500;

/** 判断用户正在点击的最大移动限度的平方 */
export const MAX_MOVE_DELTA_SQA = 2 * 2;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 地图缩放 ----------------------------
/** 最大的 zoom */
export const MAX_ZOOM = 8;

/** 正常下最小的 zoom */
export const MIN_ZOOM = 1;

/** 初始化 zoom */
export const INIT_ZOOM = 1;

/** 探索模式下最小的 zoom */
export const MIN_EXPLORE_ZOOM = 1;

/** 允许编辑的最小 zoom */
export const EDIT_ZOOM = 5;

/** 层级-速度映射 */
export const ZOOM_SPEED = new Map([
    [1, 0.5],
    [2, 0.1],
    [3, 0.05],
    [4, 0.03],
    [5, 0.02],
    [6, 0.01],
    [7, 0.01],
    [MAX_ZOOM, 0.005],
]);

/** 层级-距离映射 */
export const ZOOM_DIS = new Map([
    [1, 1000],
    [2, 500],
    [3, 200],
    [4, 100],
    [5, 70],
    [6, 50],
    [7, 30],
    [MAX_ZOOM, 20],
]);

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 相机 ----------------------------
/** 相机距离地面最远距离 */
export const CAMEARA_TO_EARTH_MAX_DIS = ZOOM_DIS.get(MIN_ZOOM);

/** 相机距离地面初始距离 */
export const CAMEARA_TO_EARTH_INIT_DIS = ZOOM_DIS.get(INIT_ZOOM);

/** 相机距离地面最近距离 */
export const CAMEARA_TO_EARTH_MIN_DIS = ZOOM_DIS.get(MAX_ZOOM);

/** fov 75 */
export const FOV = (Math.PI * 5) / 12;

/** 相机最近切面 */
export const NEAR = 0.1;

/** 相机能观察的临界角 */
export const THRESH_THETA = 0;

/** 给一个额外角 */
export const EXTRA_THETA = Math.PI / 30;

/** 网格插值的限度 */
export const LERP_SLICES = 30;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 分区 ----------------------------
/** 经度 15°一个分区 */
export const LNG_DIVIDER = 15;

/** 360 / LNG_DIVIDER */
export const LNG_SLICES = 24;

/** 纬度划区, 在视觉上把南北极 化为一个区*/
export const LAT_DIVIDER = [0, 10, 30, 50, 70, 80, 90];
// export const LAT_DIVIDER = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

/** 注意这个值 和 LAT_DIVIDER 对应起来  */
export const LAT_SLICES = 12;

/** 初始位置 */
export const INIT_GISZONE: GISZone = [7, 1];

export const INIT_LAT_LNG: LatLng = { lat: 49, lng: 2.5 };

/** 北极分区特殊俗 zone key */
export const ZONE_KEY_POLAR_N = "ZONE_KEY_POLAR_N";

/** 南极分区特殊 zone key */
export const ZONE_KEY_POLAR_S = "ZONE_KEY_POLAR_S";

/** 地块延迟加载的时间 */
export const Tile_LOAD_DELAY = 500;

/** 小地图视角框的跨度 */
export const CENTER_BOX_SPAN = 5;

// --------------------------------------------------------
// ----------------------------------------------------
// ------------------ 笔刷 ----------------------------
/** 鼠标笔刷悬浮颜色，统一颜色 */
export const BRUSH_HOVER_COLOR: XColor = [0.2, 0.2, 0.2, 0.8];

/** 笔刷最大半径 */
export const BRUSH_MAX_RADIUS = 10;

/** 笔刷最小半径 */
export const BRUSH_MIN_RADIUS = 1;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 河流 ----------------------------
/** 暂时的河流颜色 */
export const TEMP_LERP_RIVER_TILE_COLOR: XColor = [155 / 255, 218 / 255, 233 / 255, 1]; //#9bdae9

/** 河流颜色 */
export const RIVER_TILE_COLOR: XColor = [0, 200 / 255, 1, 1]; // #80e7ff

/** 山脉颜色 */
export const MOUNTAIN_TILE_COLOR: XColor = [46 / 255, 0, 0, 1]; // #400600

/** 选择河流的颜色 */
export const FOCUS_RIVER_TILE_COLOR: XColor = [0, 43 / 255, 1, 1]; // #00ccff

/** 交叉河流颜色 */
export const INTERSECT_RIVER_TILE_COLOR: XColor = [1, 0, 0, 1]; // #00ccff

/** 预计的河流最长长度，超过这个长度流向指示线可能报错 */
export const MAX_RIVER_LENGTH = 1000;

/** 河流宽度 */
export const RIVER_WIDTH = 4;

/** 河流线颜色 */
export const RIVER_LINE_COLOR = 0x80e7ff;

/** 河流聚焦线颜色 */
export const RIVER_LINE_FOCUS_COLOR = 0x00ccff;

/** 流向箭头颜色 */
export const RIVER_ARROW_COLOR = 0x000000;

export const RIVER_MAX_WIDTH = 5;

export const RIVER_MIN_WIDTH = 1;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 省 ----------------------------
export const PROVINCE_DEFAULT_COLOR: XColor = [0, 0, 0, 1];

/** 省界聚焦颜色 */
export const PROVINCE_FOCUS_EDGE_COLOR = 0xffff00;

/** 省界颜色 */
export const PROVINCE_EDGE_COLOR = 0x000000;

/** 省界宽度 */
export const PROVINCE_EDGE_WIDTH = 4;

/** 聚焦省界宽度 */
export const PROVINCE_FOCUS_EDGE_WIDTH = 8;

/** 省自动填充往外寻找最大半径 */
export const AUTOFILL_MAX_RADIUS = 5;

/** 自动填充上限 */
export const AUTOFILL_MAX_COUNT = 2000;

/** 区域外层透明度 */
export const PROVINCE_OUTER_OPACITY = 0.7;

/** 区域内层透明度 */
export const PROVINCE_INNER_OPACITY = 0.5;

/** 默认地形海洋 */
export const DEFAULT_TERRIAN = [0, 4];

export const NAME_SHOW_TILE_LIMIT = 200;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 海域 ----------------------------
export const SEA_BRUSH_COLOR: XColor = [1, 0, 0, 1];

export const SEA_COLOR: XColor = [3 / 255, 137 / 255, 210 / 255, 1];

/** 海域高亮颜色 */
export const SEA_FOCUS_COLOR: XColor = [3 / 255, 1, 1, 1];

/** 海洋边界颜色 */
export const SEA_EDGE_COLOR = 0x0000ff;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 地形 ----------------------------
/** 地形类型对应纹理图集中的位置，纹理图集采用多行10列排布
 * textureid -> 在纹理图集中的位置
 * 注意，webgl里的uv是从左下角往右上角艹的
 */
export const TILE_TEXTURE_MAP: Record<number, [number, number]> = {
    // 冰原
    0: [0, 0],
    1: [1, 0],
    2: [2, 0],
    3: [3, 0],

    // 雪原
    4: [4, 0],
    5: [5, 0],
    6: [6, 0],
    7: [7, 0],

    // 沙漠
    8: [8, 0],
    9: [9, 0],
    10: [0, 1],
    11: [1, 1],

    // 沼泽
    12: [2, 1],
    13: [3, 1],
    14: [4, 1],
    15: [5, 1],

    // 温带草原
    16: [6, 1],
    17: [7, 1],
    18: [8, 1],
    19: [9, 1],

    // 热带草原
    20: [0, 2],
    21: [1, 2],
    22: [2, 2],
    23: [3, 2],

    // 黑土地
    24: [4, 2],
    25: [5, 2],
    26: [6, 2],
    27: [7, 2],

    // 正常土地
    28: [8, 2],
    29: [9, 2],
    30: [0, 3],
    31: [1, 3],

    // 红土地
    32: [2, 3],
    33: [3, 3],
    34: [4, 3],
    35: [5, 3],

    // 热带雨林
    36: [6, 3],
    37: [7, 3],
    38: [8, 3],
    39: [9, 3],

    // 海洋
    40: [0, 4],
    41: [1, 4],

    // 悬崖
    43: [3, 4],

    // 山脉
    45: [2, 4],
};

/** 图集 行列 [ rows, cols ] */
export const TILE_TEXTURE_ATLAS: [number, number] = [5, 10];

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 资源 ----------------------------
/** 初始状态 */

/** 资源禁止摆放颜色 */
export const RESOURCE_BAN_DROP_TILE_COLOR: XColor = [1, 0, 0, 0.6];

/** 资源摆放在格子中的方向 */
export const RESOURCE_DIR = (Math.PI * 2) / 3;

/** 资源摆放在格子中的方向 */
export const RESOURCE_DIS = 1;

/** 扩大倍数，方便看 */
export const RESOURCE_MULTIPLE = 1.8;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 建筑 ----------------------------
/** 建筑摆放在格子中的方向 */
export const BUILD_DIR = (Math.PI * 4) / 3;
export const City_DIR = Math.PI;

/** 城市摆放距离中心的距离 */
export const BUILD_DIS = 1;

export const CITY_DIS = 1;

/** 城市扩展上限城市，也就是从核心城市到最外层扩展城市的半径上限 */
export const CITY_EXPAND_UPPER_LIMIT_RADIUS = 3;

/** 扩展城市数量上限 */
export const CITY_EXPAND_UPPER_LIMIT_COUNT = 2;

/** 城市间最小的距离 */
export const CITY_LEAST_GAP = 2;

/** 城市包括扩展城市外围最小间距 */
export const CITY_OUTER_LEAST_GAP = 1;

/** 已经扩展的透明度 */
export const EXTENDED_ALPHA = 0.4;

/** 待扩展透明度 */
export const EXTENSIBLE_ALPHA = 0.2;

/** 建筑扩大倍数，方便看 */
export const BUILD_MULTIPLE = 2.3;

/** 城市扩大倍数 */
export const BUILD_CITY_MULTIPLE = 2.3;

/** 扩展城市扩大倍数 */
export const BUILD_CITY_EXPAND_MULTIPLE = 2.4;

/** 区别 核心城市 的 buildtype id */
export const BUILD_CITY_ID = "build_city";

/** 建筑地图大小，每行能放下的六边形数量，奇数 */
export const BUILDING_ROW_TILE_COUNT = 5;

/** 每个地块容纳方块长度，偶数且为4的倍数 */
export const BUILD_TILE_SQUARE = 4;

export const BUILD_MAP_TILE_COLOR: XColor = [0, 0, 0, 0];

export const BUILD_MAP_TILE_HOVER_COLOR: XColor = [0, 1, 0, 0.3];

export const BUILD_MAP_TILE_EDGE_COLOR: XColor = [1, 1, 1, 0];

export const BUILD_MAP_GRID_COLOR: XColor = [1, 1, 1, 0];

export const BUILD_MAP_CITY_CORE_COLOR: XColor = [0, 1, 0, 0.8];

export const BUILD_MAP_CITY_EXPAND_COLOR: XColor = [0, 1, 0, 0.5];
export const BUILD_MAP_CITY_EXPANDABLE_COLOR: XColor = [0, 1, 0, 0.3];

/** 城市聚焦颜色 */
export const BUILD_MAP_CITY_FOCUS_COLOR: XColor = [1, 1, 0, 0.8];

/** 方位误差，度 */
export const DIR_ERROR = 30;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 路点 ----------------------------
/** 扩大倍数，方便看 */
export const WAYPOINT_MULTIPLE = 3;

/** 距离中心的距离 */
export const WAYPOINT_DIS = 0;

/** 在格子中的方向 */
export const WAYPOINT_DIR = 0;

/** 路径路径颜色 */
export const WAYPOINT_PATH_LINE_COLOR = 0x8b7c0d;

/** 海上路径路径颜色 */
export const WAYPOINT_SEA_PATH_LINE_COLOR = 0xffff00;

/** 路径聚焦路径颜色 */
export const WAYPOINT_PATH_FOCUS_LINE_COLOR = 0x00ff00;

/** 路径聚焦路径颜色色带 */
export const WAYPOINT_PATH_FOCUS_LINE_COLOR_RANGE = [0x95f204, 0xcaf982, 0x70b603];

/** 路径路径宽度 */
export const WAYPOINT_PATH_LINEWIDTH = 3;

/** 路径路径聚焦宽度 */
export const WAYPOINT_PATH_FOCUS_LINEWIDTH = 6;

/** 路点可从区域中心往外最大寻找半径 */
export const WAYPOINT_MAX_EXPAND_RADIUS = 3;

// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 军队 ----------------------------
/** 扩大倍数，方便看 */
export const MILITARY_MULTIPLE = 2;

/** 摆放在格子中的方向 */
export const MILITARY_DIR = 0;

/** 330 方位 */
export const MILITARY_LABEL_DIR = (Math.PI * 2 * 17) / 18;

/** 距离中心的距离 1 表示边缘，0表示中心 */
export const MILITARY_DIS = 1;
export const MILITARY_LABEL_DIS = 1.5;

/** 多军队使用的 模板 id */
export const MIX_TEMPLATE_ID = "MIX_MILITARY";

export const MILITARY_COUNT_COLOR = "#ffffff";
// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 植被 ----------------------------
/** 扩大倍数，方便看 */
export const TREE_MULTIPLE = 5;
/** 摆放在格子中的方向 */
export const TREE_DIR = 0;

/** 距离中心的距离 1 表示边缘，0表示中心 */
export const TREE_DIS = 0;
// --------------------------------------------------------
// --------------------------------------------------------
// ------------------ 装饰 ----------------------------
/** 摆放在格子中的方向 */
export const DECORATION_DIR = 0;

/** 距离中心的距离 1 表示边缘，0表示中心 */
export const DECORATION_DIS = 0;
/** 扩大倍数，方便看 */
export const DECORATION_MULTIPLE = 5;

/** 鼠标容差 pixel, 在这个范围内都将捕获 */
export const TOLERANCE_DIS_ERROR = 200;

export const ELEVATION_MAX = 20;
export const ELEVATION_MIN = -9;

export enum MOUSE_MODE {
    None = -1,
    Elevation = 0,
    WaterElevation = 1,
}
