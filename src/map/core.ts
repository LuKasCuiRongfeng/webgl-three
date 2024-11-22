import { IdModelMapBytesUtils, MapBytesUtils, MeshBytesUtils, ProvBytesUtils } from "./bytesUtils";
import ThreeManager, {
    AmbientLight,
    BufferAttribute,
    BufferGeometry,
    BufferGeometryUtils,
    Color,
    CustomShaderMaterial,
    DirectionalLight,
    Float32BufferAttribute,
    Mesh,
    PerspectiveCamera,
    Scene,
    SphereGeometry,
    Stats,
    Uniform,
    Vector3,
    Texture,
    SRGBColorSpace,
    MOUSE,
    PointLight,
    Lensflare,
    LensflareElement,
    Spherical,
    BackSide,
    Matrix4,
    MeshBasicMaterial,
    Group,
    MeshBVH,
    DataTexture,
    RGBAFormat,
    FloatType,
    MeshLambertMaterial,
    Frustum,
    Box3,
    Vector2,
    Quaternion,
    Tween,
} from "./three-manager";
import { getBytesUtils, readFileBase64, sleep } from "./utils";
import { LL2TID } from "./LL2TID";
import {
    ATLAS_COLUMN_COUNT,
    ATLAS_ROW_COUNT,
    CAMEARA_TO_EARTH_INIT_DIS,
    CAMEARA_TO_EARTH_MAX_DIS,
    CAMEARA_TO_EARTH_MIN_DIS,
    DEFAULT_TERRIAN,
    EDIT_ZOOM,
    HEIGHT_SEGMENTS,
    INIT_ZOOM,
    LAT_DIVIDER,
    LAT_SLICES,
    LNG_DIVIDER,
    LNG_SLICES,
    MAX_CLICKING_TIME,
    MAX_MOVE_DELTA_SQA,
    MAX_ZOOM,
    MIN_ZOOM,
    MOUSE_MODE,
    TILE_TEXTURE_MAP,
    WIDTH_SEGMENTS,
    ZOOM_DIS,
    ZOOM_SPEED,
} from "./consts";
import {
    Coordinate,
    Coordinate2D,
    GeoBounds,
    GISZone,
    GISZoneMap,
    LayerStyle,
    MapInitStatus,
    MouseIntersect,
    UV,
    XColor,
    ZoneData,
} from "./types";

import tileFrag from "./shader/tile/frag.glsl";
import tileVert from "./shader/tile/vert.glsl";
import atmoFrag from "./shader/atmosphere/frag.glsl";
import atmoVert from "./shader/atmosphere/vert.glsl";
import lensflare0 from "../assets/lensflare0.png";
import lensflare3 from "../assets/lensflare3.png";
import { elevationPointerDown, elevationPointerMove, elevationPointerUp } from "./elevation";
import { mountainPointerDown, mountainPointerMove, mountainPointerUp } from "./mountain";
import {
    createVegetationInstance,
    vegetationPointerDown,
    vegetationPointerMove,
    vegetationPointerUp,
} from "./vegetation";
import { QuadTreeNode } from "./zone";

/** 操作地图数据的对象 */
let mapBytesUtils: MapBytesUtils = null;

/** 操作地图网格的对象 */
let meshBytesUtils: MeshBytesUtils = null;

/** 操作省份 buffer 对象 */
let provBytesUtils: ProvBytesUtils = null;

/** 模型相关 */
let idModelMapBytesUtils: IdModelMapBytesUtils = null;

let manager: ThreeManager = null;

/** 由于react可能重复渲染很多次，为避免重复初始化，保证initmap只运行一次 */
let haveInitialed = false;

/** 地图初始化状态 */
const mapInitStatus: MapInitStatus = { loadPercent: 0 };

/** 性能监测 */
let performanceStats: Stats = null;

/** 当前的缩放层级 */
let mapZoom = INIT_ZOOM;

/** 鼠标点击开始时间 */
let clickStartTime = 0;

/** 鼠标点击结束时间 */
let clickEndTime = 0;

/** 点击开始位置 像素坐标 */
const clickStartPos = { x: 0, y: 0 };

/** 点击结束位置 像素坐标 */
const clickEndPos = { x: 0, y: 0 };

/** 网格球体半径，用的太多存下来 */
let earthRadius: number = undefined;

/** 大地球 */
let earth: Mesh = null;

/** zone key -> { zone, bounds } */
const zoneMap: Map<string, ZoneData> = new Map();

/** 四叉树，方便快速检索叶子节点内部的分区 */
let quadTree: QuadTreeNode = null;

/**
 * zone key -> tileIndex[]
 *
 * 分区内的所有格子索引
 * 保存该该格子在全部格子下的索引，数据初始化后不再改变
 */
const zoneTileMap: Map<string, number[]> = new Map();

/** zone key -> zone mesh */
const zoneMeshMap: Map<string, Mesh> = new Map();

/** 存放所有分区 mesh */
const zoneMeshGroup = new Group();

/**
 * tileIndex -> vertex[]
 *
 * tile对该地块所包含的顶点索引映射
 */
const tileVertexMap: Map<number, number[]> = new Map();

/** tileIndex -> zone key */
const tileZoneMap: Map<number, string> = new Map();

/** tileIndex -> uv[] */
const tileUVMap: Map<number, number[]> = new Map();

/**
 * 当前分区坐标，可以同时显示多个zone
 * 如果是南北分区就取第一个放进去
 */
let gisZones: GISZoneMap = {};

/** 是否位于低轨道 */
let isLowOrbit = false;

/** 光源轨道 */
let sunOrbit: Spherical = null;

/** 平行光 */
let dirLight: DirectionalLight = null;

/** 点光，用于光斑形成 */
let pointLight: PointLight = null;

/** 鼠标是否按下 */
let isPointerDown = false;

/** controls 是否正在操作 */
let isControlsChanging = false;

/** 鼠标相交信息 */
let mouseIntersect: MouseIntersect = {};

/** 是否需要恢复 controls */
let needsResetControl = false;

let testTree: Group = null;

/** 全局纹理，复用 */
let globalTexture: Texture = null;

const atlasDuDv = { du: 0, dv: 0 };

/** 地块类型 -> 所处纹理图集左下角uv坐标 */
const atlasMap = new Map<number, UV>();

/** 网格 uniform 变量，将传入到shader里 */
const uniforms = {
    /** 输入全局纹理 */
    uTexture: new Uniform<Texture>(null),
    /** 是否使用纯色着色，忽略纹理 */
    uPureColor: new Uniform(true),
    /** 鼠标编辑模式 */
    uMouseMode: new Uniform(MOUSE_MODE.None),
    /** tile count，shader里不支持动态循环变量，使用uniform传入 */
    uTileCount: new Uniform(0),
    /** 存放 hover tile 数据 */
    uDataTexture: new Uniform<DataTexture>(null),
    /** 通常用来暂存鼠标选中的地块 id 数组 */
    uTileHoverArray: new Uniform(new Float32Array(500)),
};

/** 大气层 uniform 变量，将传入到shader里 */
const atmUniforms = {
    /** 光源方向 */
    uSunDir: new Uniform(new Vector3(0, 0, 1)),
    /** 大气层白天颜色 */
    uAtmDay: new Uniform(new Color("#00aaff")),
    /** 大气层晨昏颜色 */
    uAtmTwilight: new Uniform(new Color("#ff6600")),
};

export const DataTextureConfig = {
    /** 每行4个 rgba， 第一个值存tileid，
     * 第二个值存edge数量，之后存13个(五边形是11个)顶点
     * 总共需要15个float，所以需要4个 rgba共16个
     */
    width: 4,
};

export async function initMap() {
    if (haveInitialed) return;
    haveInitialed = true;

    if (!meshBytesUtils) {
        // @ts-ignore
        meshBytesUtils = await getBytesUtils("mesh");
    }

    if (!mapBytesUtils) {
        // @ts-ignore
        mapBytesUtils = await getBytesUtils("map");
    }

    if (!provBytesUtils) {
        // @ts-ignore
        provBytesUtils = await getBytesUtils("mapProvs");
    }

    const { mapVersion } = mapBytesUtils.getHeader();

    if (!idModelMapBytesUtils && mapVersion < mapBytesUtils.modelMapSupportVersion) {
        // @ts-ignore
        idModelMapBytesUtils = await getBytesUtils("idModelMap");
    }

    manager = new ThreeManager({ antialias: true });
    manager.scene = new Scene();

    performanceStats = new Stats();

    mapInitStatus.loadPercent = 10;

    // 相机
    createCamerea();

    createLight();

    initZone();

    initQuadTreeNode();

    setAtlas();

    await loadGlobalTexture();

    await loadTestTree();

    createDataTexture();

    createVegetationInstance();

    onCanvasEvent();

    await preprocessTiles();

    await drawAllZoneMesh();

    mapInitStatus.loadPercent = 100;

    setInterval(() => {
        const index = Math.floor(Math.random() * 10000)
        const { x, y, z } = meshBytesUtils.getTileByIndex(index)
        const length = manager.camera.position.length()
        cameraToSpherePos(new Vector3(x, y, -z).normalize().multiplyScalar(length))
    }, 2000);
}

function render() {
    manager.loop(() => {
        manager.resizeRendererToDisplaySize();

        manager.getTweenGroup().update();

        performanceStats?.update();

        const elapsed = manager.getClock().getElapsedTime();

        udpateLight(elapsed);

        manager.getRenderer().render(manager.scene, manager.camera);
    });
}

/** 取消渲染循环，节约性能，通常用于在切换到其他非地图页面时 */
export function cancelRender() {
    if (!manager) return;
    manager.loop(null);
    manager.getRenderer().domElement.remove();
}

/** 挂载canvas，canvas 动态生成，以被各个组件复用 */
export function appendCanvas(container: HTMLDivElement) {
    if (!manager) return;

    const canvas = manager.getRenderer().domElement;

    if (!canvas.id) {
        canvas.id = "savery-canvas-map";
    }

    if (canvas.parentElement == null) {
        container.appendChild(canvas);
        document.body.appendChild(performanceStats.dom);
        render();
    }
}

/** 初始化相机 */
function createCamerea() {
    const { radius, cornersCount } = meshBytesUtils.getHeader();
    // 重置顶点数量，非常重要
    getLL2TID().CornerTop = cornersCount;

    earthRadius = radius;

    const initDis = radius + CAMEARA_TO_EARTH_INIT_DIS;

    // 相机
    manager.camera = new PerspectiveCamera(50, 1, 0.1, initDis);
    manager.camera.position.set(0, 0, initDis);

    const controls = getOrbitControls();

    controls.enableDamping = false;
    controls.enablePan = false;
    controls.maxDistance = radius + CAMEARA_TO_EARTH_MAX_DIS;
    controls.minDistance = radius + CAMEARA_TO_EARTH_MIN_DIS;

    controls.mouseButtons = {
        RIGHT: MOUSE.ROTATE,
    };

    onControlsEvent();
}

/** 相机球面动画 */
export function cameraToSpherePos(to: Vector3) {
    return new Promise((resolve) => {
        if (isLowOrbit) {
            const controls = getOrbitControls();
            const target = controls.target;

            const obj = { t: 0 };
            const start = target.clone().normalize();
            const end = to.clone().normalize();

            const quat = new Quaternion();
            const quat1 = new Quaternion().setFromUnitVectors(start, end);

            const tween = new Tween(obj)
                .to({ t: 1 }, 300)
                .onUpdate(() => {
                    target.applyQuaternion(quat.clone().slerp(quat1, obj.t));
                    // 同时不断更新camera的位置
                })
                .start()
                .onComplete(() => resolve(0));

            manager.getTweenGroup().add(tween);
        } else {
            manager.createSphereTween(to).onComplete(() => resolve(0));
        }
    });
}

/** 注册控件事件 */
function onControlsEvent() {
    const controls = getOrbitControls();
    controls.addEventListener("change", onControlsChanging);
    controls.addEventListener("end", onControlsChanged);
    controls.addEventListener("wheel", onControlsWheel);
}

function onControlsChanging() {
    isControlsChanging = true;
    setChangingControls();
}

function onControlsChanged() {
    isControlsChanging = false;
    setChangedControls();
}

function onControlsWheel() {
    updateCameraFar();
    setCameraPose();
    updateWheelZoom();
}

export function banControl() {
    const controls = getOrbitControls();
    controls.enableZoom = false;
    controls.enablePan = false;
    needsResetControl = true;
}

/** 恢复控件 */
export function resetControl(force?: boolean) {
    if (!needsResetControl && !force) return;

    const controls = getOrbitControls();
    controls.enableZoom = true;
    controls.enablePan = true;
}

/** 根据距离更新相机远平面，利用视锥剔除提升性能 */
function updateCameraFar() {
    // 根据距离调整投影矩阵，可以利用视锥剔除有效减少需要渲染的面，提升性能
    const camera = manager.camera;
    const dis = camera.position.length();
    camera.far = dis;

    if (mapZoom >= EDIT_ZOOM) {
        // camera.far = dis / 5;
        // 预估最多看得到100个单位
        camera.far = 100;
    }

    //  必须更新投影矩阵
    camera.updateProjectionMatrix();
}

/** 设置相机姿态 */
function setCameraPose() {
    const controls = getOrbitControls();
    // 可以编辑的离地面最大距离
    const maxEditDis = ZOOM_DIS.get(EDIT_ZOOM);

    const pos = manager.camera.position;
    let dis = pos.length() - earthRadius;

    // 进入编辑距离
    if (dis <= maxEditDis) {
        if (isLowOrbit) {
            // 此时 target已经改变，放到球面上，重新计算距离target距离
            dis = pos.clone().sub(controls.target).length();
        }

        // 根据距离target的距离，线性计算倾斜角度
        const angle =
            controls._tiltMaxAngle *
            (1 - (dis - CAMEARA_TO_EARTH_MIN_DIS) / (maxEditDis - CAMEARA_TO_EARTH_MIN_DIS));

        if (!isLowOrbit) {
            controls.minDistance = CAMEARA_TO_EARTH_MIN_DIS;
            controls.target.copy(pos.clone().normalize().multiplyScalar(earthRadius));
            controls.setIsTiltZoom(true);

            controls.enablePan = true;
            controls.enableRotate = false;
            controls.mouseButtons = {
                RIGHT: MOUSE.PAN,
            };

            isLowOrbit = true;
            uniforms.uPureColor.value = false;

            // 重要，更新前更新倾角
            controls.setCameraOrthTiltAngle(angle);
            controls.update();
        }

        controls.setCameraOrthTiltAngle(angle);
    } else if (isLowOrbit) {
        // 重置target到原点
        controls.target.copy(new Vector3(0, 0, 0));
        controls.setIsTiltZoom(false);

        controls.enablePan = false;
        controls.enableRotate = true;
        controls.mouseButtons = {
            RIGHT: MOUSE.ROTATE,
        };

        isLowOrbit = false;
        uniforms.uPureColor.value = true;

        controls.update();
    }
}

function setChangedControls() {}

function setChangingControls() {}

/** 根据距离更新 zoom */
function updateWheelZoom() {
    const pos = manager.camera.position;
    const dis = pos.length() - earthRadius;
    const controls = getOrbitControls();

    let zoom = MAX_ZOOM;

    while (zoom > 0) {
        if (dis <= ZOOM_DIS.get(zoom)) {
            mapZoom = zoom;
            break;
        }
        zoom--;
    }

    // 控制缩放的速度和旋转的速度
    const speed = ZOOM_SPEED.get(mapZoom);

    if (!isLowOrbit) {
        controls.rotateSpeed = speed;
        controls.zoomSpeed = speed * 3.6;
    } else if (isLowOrbit) {
        controls.rotateSpeed = 1;
        controls.zoomSpeed = 2;
        controls.panSpeed = 0.006;
    }
}

/** 设置缩放 */
export function setZoom(zoom: number) {
    if (zoom > MAX_ZOOM) {
        zoom = MAX_ZOOM;
    }
    if (zoom < MIN_ZOOM) {
        zoom = MIN_ZOOM;
    }

    if (zoom === mapZoom) return;

    mapZoom = zoom;

    const length = ZOOM_DIS.get(mapZoom) + earthRadius;
    const position = manager.camera.position;

    const des = manager.getCollinearVector(position, length);

    // mapZoom 不涉及球体旋转，不使用球面插值动画
    manager.createLineTween(des).onComplete(() => {
        // 更新一下zoom
        updateWheelZoom();
    });
}

function createLight() {
    dirLight = new DirectionalLight(0xffffff, 6);
    dirLight.position.copy(manager.camera.position);
    const ambientLight = new AmbientLight(0xffffff, 2);

    // 光晕
    const loader = manager.getTextureLoader();
    const lens0 = loader.load(lensflare0);
    const lens3 = loader.load(lensflare3);

    pointLight = new PointLight(0xffffff, 0.5, 2000, 0);
    pointLight.color.setHSL(0.995, 0.5, 0.9);
    pointLight.position.copy(manager.camera.position);

    const len = new Lensflare();
    len.addElement(new LensflareElement(lens0, 700, 0, pointLight.color));
    len.addElement(new LensflareElement(lens3, 100, 0.1));
    len.addElement(new LensflareElement(lens3, 160, 0.2));
    len.addElement(new LensflareElement(lens3, 100, 0.3));
    pointLight.add(len);

    // 直射北回归线
    sunOrbit = new Spherical(2000, 66.6 * (Math.PI / 180), 0);

    manager.scene.add(dirLight, ambientLight, pointLight);

    createAtmosphere();
}

function udpateLight(elapsed: number) {
    if (!sunOrbit || !pointLight || !dirLight) return;

    const v = new Vector3();

    // 灯光位置使用动画旋转的轨道位置
    // sunOrbit.theta = elapsed * 0.5;

    // 灯光位置使用相机位置
    sunOrbit.setFromVector3(manager.camera.position);
    // 稍微往左偏离一个角度
    sunOrbit.theta -= Math.PI / 20;

    v.setFromSpherical(sunOrbit);

    pointLight.position.copy(v);
    dirLight.position.copy(v);
    atmUniforms.uSunDir.value.copy(v.normalize());
}

function createAtmosphere() {
    const atm = new Mesh(
        new SphereGeometry(earthRadius, WIDTH_SEGMENTS, HEIGHT_SEGMENTS),
        new CustomShaderMaterial({
            // baseMaterial: MeshPhongMaterial,
            // 不需要高光
            baseMaterial: MeshLambertMaterial,
            // 技巧，显示背面，剔除正面
            side: BackSide,
            // 需要使用透明度
            transparent: true,
            uniforms: atmUniforms,
            vertexShader: atmoVert,
            fragmentShader: atmoFrag,
        })
    );

    // 稍微放大，包围地球
    atm.scale.set(1.06, 1.06, 1.06);
    manager.scene.add(atm);
}

/** 监听canvas 事件 */
function onCanvasEvent() {
    const canvas = manager.getRenderer().domElement;

    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
}

function pointerDown(e: PointerEvent) {
    isPointerDown = true;
    if (mapZoom < EDIT_ZOOM) return;

    clickStartTime = performance.now();
    const ss = manager.getCanvasScreenSpace(e);
    clickStartPos.x = ss.x;
    clickStartPos.y = ss.y;

    elevationPointerDown(e);
    mountainPointerDown(e);
    vegetationPointerDown(e);
}

function pointerMove(e: PointerEvent) {
    setMouseIntersect(e);
    if (mapZoom < EDIT_ZOOM) return;

    elevationPointerMove(e);
    mountainPointerMove(e);
    vegetationPointerMove(e);
}

function pointerUp(e: PointerEvent) {
    isPointerDown = false;

    elevationPointerUp(e);
    mountainPointerUp(e);
    vegetationPointerUp(e);
}

/** 计算鼠标相交 */
function setMouseIntersect(e: PointerEvent) {
    const ndc = manager.getCanvasNDC(e);
    let point: Vector3 = null;
    let uv: Vector2 = null;

    if (mapZoom < EDIT_ZOOM) {
        // 使用性能更高的拾取
        point = manager.getIntersectOfRay(earthRadius, ndc);
    } else {
        const intersect = manager.rayPicker([zoneMeshGroup], ndc, true);
        if (intersect == null) return;
        point = intersect.point;
        uv = intersect.uv;
    }

    if (!point) return;

    const latlng = manager.vector3ToLatLng(point);
    const tileIndex = getLL2TID().LLConvertPos(-latlng.lng, latlng.lat);

    mouseIntersect = {
        point,
        tileIndex,
        latlng,
        uv,
    };
}

/** 通常用于特定目的的计算，一般不需要使用 */
export function getIntersectOfMesh(ndc: Coordinate2D) {
    const intersect = manager.rayPicker([zoneMeshGroup], ndc, true);
    if (intersect == null) return;
    const { point, uv } = intersect;
    if (!point) return;

    const latlng = manager.vector3ToLatLng(point);
    const tileIndex = getLL2TID().LLConvertPos(-latlng.lng, latlng.lat);
    return {
        point,
        tileIndex,
        latlng,
        uv,
    };
}

/**
 * 是否是在点击画布，由于点击事件同时会触发 control的事件，
 * 在这里做一个区分，如果用户点击的时间很短，并且鼠标移动
 * 了很短的距离，认为用户只是在点击，而不是在拖拽地图
 */
export function isShortClick() {
    if (
        clickEndTime - clickStartTime < MAX_CLICKING_TIME &&
        (clickEndPos.x - clickStartPos.x) ** 2 + (clickEndPos.y - clickStartPos.y) ** 2 <
            MAX_MOVE_DELTA_SQA
    ) {
        return true;
    }

    return false;
}

/** 获取轨道控件 */
function getOrbitControls() {
    return manager.getOrbitControls(manager.camera, manager.getRenderer().domElement);
}

export function getManager() {
    return manager;
}

/** 获取经纬度转 tileindex 工具 */
export function getLL2TID() {
    return LL2TID;
}

/** 拿到 二进制数据文件 处理对象 */
export function getGlobalBytesUtils() {
    return { mapBytesUtils, meshBytesUtils, provBytesUtils, idModelMapBytesUtils };
}

export function getGlobalMap() {
    return {
        zoneMeshMap,
        tileVertexMap,
        tileZoneMap,
    };
}

export function getMouseIntersect() {
    return mouseIntersect;
}

export function getMapInitStatus() {
    return mapInitStatus;
}

export function getZoneKey(zone: GISZone) {
    return JSON.stringify(zone);
}

export function getUniforms() {
    return uniforms;
}

export function setEditType(type: MOUSE_MODE) {
    uniforms.uMouseMode.value = type;
}

export function getEditType() {
    return uniforms.uMouseMode.value;
}

/** 基于广度优先搜索迭代层级 */
export function traverseTileBFS(level: number, tileIndex: number) {
    const visited: Set<number> = new Set();
    const queue = [tileIndex];
    let step = 0;
    const result: number[][] = [];

    while (queue.length > 0 && step < level) {
        const size = queue.length;
        result[step] = [];

        for (let i = 0; i < size; i++) {
            const index = queue.shift();

            if (!visited.has(index)) {
                visited.add(index);
                result[step].push(index);

                const { tiles } = meshBytesUtils.getTileByIndex(index);
                queue.push(...tiles);
            }
        }

        step++;
    }

    return result;
}

function setAtlas() {
    const du = 1 / ATLAS_COLUMN_COUNT;
    const dv = 1 / ATLAS_ROW_COUNT;
    atlasDuDv.du = du;
    atlasDuDv.dv = dv;

    for (const [tId, [col, row]] of Object.entries(TILE_TEXTURE_MAP)) {
        // 所处纹理图集区域的左下角uv坐标
        const u = col * du;
        const v = row * dv;
        atlasMap.set(Number(tId), [u, v]);
    }
}

/** 加载全局纹理 */
async function loadGlobalTexture() {
    const image = new Image();
    let src = await readFileBase64();
    src = `data:image/png;base64,${src}`;
    image.src = src;

    const texture = new Texture(image);
    texture.colorSpace = SRGBColorSpace;
    image.onload = () => (texture.needsUpdate = true);

    globalTexture = texture;
    uniforms.uTexture.value = globalTexture;
}

/**
 * 创建用于临时的tile datatexture，用于着色器使用
 * 
 * 使用float type
 * 
 * 行数代表tile数量
 * 
 * 每一行存：
 * 第一个值存 tileId
 * 第二个值存 边数，六边形 = 6，五边形 = 5
 * 
 * 之后依次存13个顶点的索引
 * 五边形是11个，预留13个
 * 
 * 总共每个tile需要15个float存储
 * 至少需要 4个rgba像素也就是16个float

 * 每行 16个float
 * 每次更新直接整个替换data，不打算局部更新某个值

 * 4个 rgba = 16
 */
function createDataTexture() {
    const width = DataTextureConfig.width;
    const height = 1;

    const size = width * height * 4;

    const data = new Float32Array(size);

    const texture = new DataTexture(data, width, height, RGBAFormat, FloatType);

    uniforms.uDataTexture.value = texture;
}

export async function loadTestTree() {
    const loader = manager.getGLTFLoader();
    const gltf = await loader.loadAsync("http://localhost:12345/fuck/quiver_tree_02_1k.gltf");
    testTree = gltf.scene;
}

export function getTestTree() {
    return testTree;
}

/**
 * ##为了快速定位，采取地理坐标分区，初始化地图时先调用
 *
 * 采用东西经度从本初子午线 0° 开始，每隔开一定经度划一个经度大区，
 * 从 0 ~ 360 依次标为 1 2 3 4 5 ...
 *
 * 在每个经度大区里，从南极点 -90° 开始在南北纬隔开一定经度划一个纬度大区，
 * 从 -90~90 依次标为 1 2 3 4 5 ...
 *
 * 如何定位一个区？采用二元数定位，并按照先纬度后经度的惯例
 * 比如 [1, 2] 代表纬度分区1和经度分区2的分区
 *
 * 需要特别注意的坑爹地方是(我真的会淦铊🐎)：
 *
 * threejs用的是右手坐标系，而unity用的是左手坐标系
 * 通常只需把unity坐标的 z 坐标反向就能放到threejs坐标体系下
 *
 * 还有一点比较坑爹的是，unity的0度经线是 x+，经度从 x 轴正向开始逆时针增加经度
 * 而threejs 0度经线是z+，通常是从 z+ 正向开始逆时针增加经度
 */
function initZone() {
    for (let lng = 1; lng <= LNG_SLICES; lng++) {
        for (let lat = 1; lat <= LAT_SLICES; lat++) {
            const zone: GISZone = [lat, lng];
            const key = getZoneKey(zone);
            const { lonMin, lonMax, latMax, latMin, center } = getZoneBox(zone);
            zoneMap.set(key, {
                zone,
                bounds: {
                    lonMin: lonMin,
                    lonMax: lonMax,
                    latMin: latMin,
                    latMax: latMax,
                    center,
                },
            });
        }
    }
}

/** 初始化四叉树节点，初始节点覆盖整个地图 */
function initQuadTreeNode() {
    // 初始节点覆盖整个地球
    quadTree = new QuadTreeNode(
        {
            lonMin: -180,
            lonMax: 180,
            latMin: -90,
            latMax: 90,
        },
        manager,
        earthRadius
    );

    // 插入所有分区到节点
    for (const [_, zone] of zoneMap) {
        quadTree.insert(zone);
    }
}

/** 获取分区的包围盒 */
export function getZoneBox(zone: GISZone): GeoBounds {
    let [lat, lng] = zone;

    let latMax = 0,
        latMin = 0,
        lonMax = 0,
        lonMin = 0;

    if (lat > LAT_SLICES / 2) {
        lat = lat - LAT_SLICES / 2;
        latMax = LAT_DIVIDER[lat];
        latMin = LAT_DIVIDER[lat - 1];
    } else {
        lat = LAT_SLICES / 2 - lat;
        latMax = -LAT_DIVIDER[lat];
        latMin = -LAT_DIVIDER[lat + 1];
    }

    if (lng <= LNG_SLICES / 2) {
        lonMax = LNG_DIVIDER * lng;
        lonMin = LNG_DIVIDER * (lng - 1);
    } else {
        lng = LNG_SLICES - lng;
        lonMin = -(lng + 1) * LNG_DIVIDER;
        lonMax = -lng * LNG_DIVIDER;
    }

    return {
        lonMin,
        lonMax,
        latMax,
        latMin,
        center: { lat: (latMax + latMin) / 2, lng: (lonMin + lonMax) / 2 },
    };
}

/** 返回点所在的分区 */
export function getZoneByPoint(v: Vector3): GISZone {
    const { lat, lng } = manager.vector3ToLatLng(v);
    let lngZone = Math.floor(lng / LNG_DIVIDER);

    if (lng >= 0) {
        lngZone += 1;
    } else {
        lngZone += LNG_SLICES + 1;
    }

    let latZone = 0;

    for (let i = 1; i < LAT_DIVIDER.length; i++) {
        if (Math.abs(lat) <= LAT_DIVIDER[i]) {
            latZone = i;
            break;
        }
    }
    if (lat < 0) {
        latZone = LAT_SLICES / 2 - latZone + 1;
    } else {
        latZone += LAT_SLICES / 2;
    }

    // 检查
    if (latZone === 0) return;

    return [latZone, lngZone];
}

function setZones() {}

function afterVisibleZoneChange() {}

function beforeVisibleZoneChange() {}

/** 获取该分区的相邻分区， 不包括自己 */
export function getAdjacentZones(zone: GISZone) {
    const [lat] = zone;

    const min = Math.max(1, lat - 1);
    const max = Math.min(LAT_SLICES, lat + 1);

    const zs: GISZoneMap = {};

    for (let i = min; i <= max; i++) {
        for (let j = 1; j <= LNG_SLICES; j++) {
            const z: GISZone = [i, j];
            const key = getZoneKey(z);

            if (isAdjacentZones(zone, z) && !zs[key]) {
                zs[key] = z;
            }
        }
    }

    return zs;
}

/** 判断是否是相邻分区 */
export function isAdjacentZones(zone1: GISZone, zone2: GISZone) {
    if (!zone1 || !zone2) return false;

    if (getZoneKey(zone1) === getZoneKey(zone2)) return false;

    const [zLat1, zLng1] = zone1;
    const [zLat2, zLng2] = zone2;

    if (
        Math.abs(zLat1 - zLat2) <= 1 &&
        (Math.abs(zLng1 - zLng2) <= 1 || Math.abs(zLng1 - zLng2) === LNG_SLICES - 1)
    ) {
        return true;
    }

    return false;
}

/** 检查是否是可见区域 */
export function isVisibleZone(zone: GISZone, frustum: Frustum) {
    const { lonMin, lonMax, latMax, latMin, center } = getZoneBox(zone);
    // 左上
    const lt = manager.latLngToVector3(latMax, lonMin, earthRadius);
    // 左下
    const lb = manager.latLngToVector3(latMin, lonMin, earthRadius);
    // 右上
    const rt = manager.latLngToVector3(latMax, lonMax, earthRadius);
    // 右下
    const rb = manager.latLngToVector3(latMin, lonMax, earthRadius);

    // 加中心更准确
    const c = manager.latLngToVector3(center.lat, center.lng, earthRadius);

    const box = new Box3();
    const corners = [lt, lb, rt, rb, c];
    corners.forEach((v) => box.expandByPoint(v));

    return frustum.intersectsBox(box);
}

export function getVisibleZone(frustum: Frustum) {
    if (!quadTree) return;

    // return quadTree.query(frustum)

    // 不要用根节点去检查
    // 根节点的box是连接南北两极的条状
    // 只有当相机的far比较远时才会有交点
    // 对于这个项目反而不适用
    // 直接使用子节点去检查

    const children = quadTree.children;
    const result: ZoneData[] = [];

    for (const child of children) {
        const res = child.query(frustum);
        result.push(...res);
    }

    return result;
}

/** 计算地块的正向，以观察者视角为准，返回单位向量 */
export function getTileN(center: Vector3) {
    const { y } = center;
    const n = new Vector3(0, 1, 0);

    // 赤道
    if (y === 0) return n;

    const angle = n.angleTo(center);
    const length = earthRadius / Math.cos(angle);

    n.multiplyScalar(length).sub(center).normalize();

    // 注意方向，南半球反向
    if (y < 0) {
        n.negate();
    }

    return n;
}

/** 坐标是否可见 */
export function isVisibleVector(v: Vector3, frustum: Frustum) {
    return frustum.containsPoint(v);
}

/**
 * 近似计算地块某个顶点 uv 坐标
 * @param bl 左下角uv坐标
 * @param vertex 需要计算的顶点坐标
 * @param center 坐标范围中心
 * @param n 地块正向
 */
function getTileVertexUV(bl: UV, vertex: Vector3, center: Vector3, n: Vector3): UV {
    const { du, dv } = atlasDuDv;
    const [u, v] = bl;

    const dir = vertex.clone().sub(center).normalize();
    const angle = dir.angleTo(n);

    // 直接计算的夹角没有方向，这里需要判断夹角方向，使用叉积判断
    // 在threejs右手坐标系下，叉积指向外逆时针方向，反之为顺时针方向
    const { z } = n.clone().cross(dir);

    const halfU = du / 2;
    const halfV = dv / 2;

    if (z >= 0) {
        // dir 在 n 的逆时针方向
        const _u = u + halfU - halfU * Math.sin(angle);
        const _v = v + halfV + halfV * Math.cos(angle);
        return [_u, _v];
    }

    if (z < 0) {
        // dir 在 n 的顺时针方向
        const _u = u + halfU + halfU * Math.sin(angle);
        const _v = v + halfV + halfV * Math.cos(angle);
        return [_u, _v];
    }
}

/** 获取地块的 uv 坐标 */
function getTileUV(tileIndex: number) {
    const { type, elevation, waterElevation } = mapBytesUtils.getTileByIndex(tileIndex);
    const { x, y, z, corners } = meshBytesUtils.getTileByIndex(tileIndex);

    const center = new Vector3(x, y, -z);
    const n = getTileN(center);

    let tId = type;
    if (elevation <= waterElevation) {
        tId = 40;
    }

    const [u, v] = atlasMap.get(tId);
    const { du, dv } = atlasDuDv;

    // 地块中心近似uv
    const cu = u + du / 2;
    const cv = v + dv / 2;

    const uvs: number[] = [];

    corners.forEach((i) => {
        const { x, y, z } = meshBytesUtils.getCornerByIndex(i);
        const uv = getTileVertexUV([u, v], new Vector3(x, y, -z), center, n);
        uvs.push(...uv);
    });

    const lerpUV: number[] = [];
    // 插值 uv
    for (let i = 0; i < uvs.length; i += 2) {
        const u = uvs[i];
        const v = uvs[i + 1];
        lerpUV.push((cu + u) / 2, (cv + v) / 2);
    }

    // 记得加上中心uv
    lerpUV.push(cu, cv);

    uvs.push(...lerpUV);

    return uvs;
}

/** 预处理地块，将地块分配给对应的分区 */
async function preprocessTiles() {
    const { tilesCount } = meshBytesUtils.getHeader();
    // 预分区，包括网格和地图数据
    for (let i = 0; i < tilesCount; i++) {
        const { x, y, z } = meshBytesUtils.getTileByIndex(i);
        const zone = getZoneByPoint(new Vector3(x, y, -z));
        if (!zone) continue;

        // 预先分配好每个地块对应的分区
        tileZoneMap.set(i, getZoneKey(zone));

        const key = getZoneKey(zone);
        const tiles = zoneTileMap.get(key);

        if (!tiles) {
            zoneTileMap.set(key, [i]);
        } else {
            tiles.push(i);
        }

        // 预先分配好每个地块对应的顶点uv
        const uvs = getTileUV(i);
        tileUVMap.set(i, uvs);

        // 通过睡眠 ease cpu 的计算
        if (i % 100000 === 0) {
            const per = Math.round((i / tilesCount) * 100);
            mapInitStatus.loadPercent = 10 + 0.5 * per;
            await sleep(0);
        }
    }
}

/** 细分更多的结构 */
export function createTileGeometry(op: {
    vertices: Coordinate[];
    center: Coordinate;
    tileIndex: number;
    color?: XColor;
    elevation?: number;
    waterElevation?: number;
    type?: number;
}) {
    const { vertices, center, elevation, waterElevation, tileIndex } = op;
    const geometry = new BufferGeometry();

    const points: number[] = [];
    const uvs = tileUVMap.get(tileIndex);

    const aEle: number[] = [];
    const aWaterEle: number[] = [];
    const aTileId: number[] = [];

    const count = vertices.length;

    // 增加顶点数量，增加细分，直接取顶点到中心的中点
    for (let i = 0; i < count; i++) {
        const { x, y, z } = vertices[i];
        // 内圈和原顶点坐标一样
        vertices.push({ x, y, z });
    }

    // 加上中心
    vertices.push(center);

    vertices.forEach((v) => {
        const { x, y, z } = v;
        points.push(x, y, z);
        aEle.push(elevation);
        aWaterEle.push(waterElevation);
        aTileId.push(tileIndex);
    });

    geometry.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("aTileId", new Float32BufferAttribute(aTileId, 1));
    geometry.setAttribute("aEle", new BufferAttribute(new Float32Array(aEle), 1));
    geometry.setAttribute("aWaterEle", new BufferAttribute(new Float32Array(aWaterEle), 1));

    if (count === 6) {
        // 正六边形再次细分为18个三角面
        geometry.setIndex([
            0, 1, 7, 0, 7, 6, 1, 2, 8, 1, 8, 7, 2, 3, 9, 2, 9, 8, 3, 4, 10, 3, 10, 9, 4, 11, 10, 4,
            5, 11, 5, 6, 11, 5, 0, 6, 6, 7, 12, 7, 8, 12, 8, 9, 12, 9, 10, 12, 10, 11, 12, 11, 6,
            12,
        ]);
    } else {
        // 正五边形细分为15个三角面
        geometry.setIndex([
            0, 1, 6, 0, 6, 5, 1, 2, 7, 1, 7, 6, 2, 3, 8, 2, 8, 7, 3, 4, 9, 3, 9, 8, 4, 5, 9, 4, 0,
            5, 5, 6, 10, 6, 7, 10, 7, 8, 10, 8, 9, 10, 9, 5, 10,
        ]);
    }
    // 重要，计算法线，用于着色器地形生成
    geometry.computeVertexNormals();

    return geometry;
}

/**
 * 渲染所有分区对应的网格，每个分区预先渲染好一个网格
 *
 * 这种比merge geometry 更实惠
 * 占据更少的内存，但会多一些drawcall，需谨慎平衡
 */
async function drawAllZoneMesh() {
    manager.scene.add(zoneMeshGroup);

    let count = 0;
    const size = zoneTileMap.size;

    for (const [zone, tiles] of zoneTileMap) {
        const geoArr: BufferGeometry[] = [];
        let curVertexIndex = 0;

        for (let i = 0, len = tiles.length; i < len; i++) {
            const tileIndex = tiles[i];

            const { corners, x, y, z } = meshBytesUtils.getTileByIndex(tileIndex);
            const { type, elevation, waterElevation } = mapBytesUtils.getTileByIndex(tileIndex);

            // 六边形 13个顶点，五边形11个顶点
            const corLen = corners.length === 6 ? 13 : 11;
            let _corLen = 0;

            // 这个地块包含的顶点索引
            const tileVerts: number[] = [];
            while (_corLen < corLen) {
                // 按照顺序记录顶点索引
                tileVerts.push(curVertexIndex + _corLen);
                _corLen++;
            }
            tileVertexMap.set(tileIndex, tileVerts);
            curVertexIndex += corLen;

            const vertices = corners.map<Coordinate>((v) => {
                const corner = meshBytesUtils.getCornerByIndex(v);
                // 注意把z坐标反向
                return {
                    x: corner.x,
                    y: corner.y,
                    z: -corner.z,
                };
            });

            // 这里是每个地块生成一个geometry再合并
            // 一个顶点只用在一个geometry里，存在顶点浪费
            // 实际上每个顶点被三个地块共用，可用更加节省内存
            geoArr.push(
                createTileGeometry({
                    vertices,
                    center: { x, y, z: -z },
                    elevation,
                    waterElevation,
                    type,
                    tileIndex,
                })
            );
        }

        const geometry = BufferGeometryUtils.mergeGeometries(geoArr, false);
        // 更新 bvh
        geometry.boundsTree = new MeshBVH(geometry);

        const material = new CustomShaderMaterial({
            // baseMaterial: MeshPhongMaterial,
            // 使用这个材质，不需要高光
            baseMaterial: MeshLambertMaterial,
            uniforms,
            vertexShader: tileVert,
            fragmentShader: tileFrag,
        });

        const mesh = new Mesh(geometry, material);
        // 加一个标记方便知道是那个zone
        mesh.userData.zone = zone;

        zoneMeshGroup.add(mesh);
        zoneMeshMap.set(zone, mesh);

        // 更新geometry顶点
        // 选择在这里更新顶点而不是着色器，是因为
        // raycast只认geometry的顶点，我操你🐎
        const posAttr = geometry.getAttribute("position");
        const noramlAttr = geometry.getAttribute("normal");
        const aEleAttr = geometry.getAttribute("aEle");
        const aWaterEleAttr = geometry.getAttribute("aWaterEle");

        const vertCount = posAttr.count;

        for (let i = 0; i < vertCount; i++) {
            const ele = aEleAttr.getX(i);
            const waterEle = aWaterEleAttr.getX(i);
            const altitude = Math.max(ele, waterEle);

            const x = posAttr.getX(i) + altitude * noramlAttr.getX(i);
            const y = posAttr.getY(i) + altitude * noramlAttr.getY(i);
            const z = posAttr.getZ(i) + altitude * noramlAttr.getZ(i);

            posAttr.setX(i, x);
            posAttr.setY(i, y);
            posAttr.setZ(i, z);
        }

        posAttr.needsUpdate = true;
        // 重新生成geometry顶点后必须重新构建bvh，否则不能
        // 获得正确的射线交点
        geometry.boundsTree = new MeshBVH(geometry);

        if (count % 1 === 0) {
            const per = Math.round((count / size) * 100);
            mapInitStatus.loadPercent = 60 + 0.4 * per;
            await sleep(0);
        }

        count++;
    }
}
