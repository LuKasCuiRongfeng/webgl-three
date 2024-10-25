import { IdModelMapBytesUtils, MapBytesUtils, MeshBytesUtils, ProvBytesUtils } from "./bytesUtils";
import ThreeManager, {
    AmbientLight,
    BufferAttribute,
    BufferGeometry,
    BufferGeometryUtils,
    CustomShaderMaterial,
    DirectionalLight,
    Mesh,
    MeshBasicMaterial,
    MeshPhongMaterial,
    PerspectiveCamera,
    Scene,
    SphereGeometry,
    TWEEN,
    Vector3,
} from "./three-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { getBytesUtils, sleep } from "./utils";
import { LL2TID } from "./LL2TID";
import {
    CAMEARA_TO_EARTH_INIT_DIS,
    CAMEARA_TO_EARTH_MAX_DIS,
    CAMEARA_TO_EARTH_MIN_DIS,
    EARTH_COLOR,
    HEIGHT_SEGMENTS,
    TILE_LAND_ALPHA_COLOR,
    TILE_LAND_COLOR,
    WIDTH_SEGMENTS,
} from "./consts";
import { Coordinate, MapInitStatus, XColor } from "./types";

import fragment from "./frag.glsl";
import vertex from "./vert.glsl";

/** 操作地图数据的对象 */
let mapBytesUtils: MapBytesUtils = null;

/** 操作地图网格的对象 */
let meshBytesUtils: MeshBytesUtils = null;

/** 操作省份 buffer 对象 */
let provBytesUtils: ProvBytesUtils = null;

/** 模型相关 */
let idModelMapBytesUtils: IdModelMapBytesUtils = null;

/** 3d操作的大对象，管理一切渲染 */
let manager: ThreeManager = null;

/** 由于react可能重复渲染很多次，为避免重复初始化，保证initmap只运行一次 */
let haveInitialed = false;

/** 鼠标点击开始时间 */
let mapClickStartTime = 0;

/** 鼠标点击结束时间 */
let mapClickEndTime = 0;

/** 点击开始位置canvas 坐标 */
const mapClickStartPos = { x: 0, y: 0 };

/** 点击结束位置canvas 坐标 */
const mapClickEndPos = { x: 0, y: 0 };

let earthRadius: number = undefined;

/** 大地球 */
let earth: Mesh = null;

/** 所有 tileindex -> vertex[] */
const TileVertexIndexMap: Map<number, number[]> = new Map();

/** 所有 faceIndex -> tileIndex */
const faceTileIndexMap: Map<number, number> = new Map();

/** 地图初始化状态 */
const mapInitStatus: MapInitStatus = { loadPercent: 0 };

export async function initMap() {
    if (haveInitialed) {
        // 已经初始化了
        return;
    }

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

    mapInitStatus.loadPercent = 10;

    // 相机
    initCamera();

    // createEarth();

    crateLight();

    registerCanvasEvent(manager.getRenderer().domElement);

    await preprocessTiles();

    await drawLayer();

    mapInitStatus.loadPercent = 100;
}

/** 初始化相机 */
function initCamera() {
    const { radius, tilesCount, cornersCount } = meshBytesUtils.getHeader();
    // 重置顶点数量，非常重要
    getLL2TID().CornerTop = cornersCount;

    earthRadius = radius;

    // 相机
    manager.camera = new PerspectiveCamera(50, 1, 0.1, radius * 2);

    manager.camera.position.set(0, 0, radius + CAMEARA_TO_EARTH_INIT_DIS);

    const control = getOrbitControls();

    // control.enableDamping = true;
    control.enablePan = false;
    control.maxDistance = radius + CAMEARA_TO_EARTH_MAX_DIS;
    control.minDistance = radius + CAMEARA_TO_EARTH_MIN_DIS;
}

/** 获取经纬度转 tileindex 工具 */
export function getLL2TID() {
    return LL2TID;
}

/** 拿到 二进制数据文件 处理对象 */
export function getGlobalBytesUtils() {
    return { mapBytesUtils, meshBytesUtils, provBytesUtils, idModelMapBytesUtils };
}

/** 获取 轨道 控件 */
function getOrbitControls() {
    return manager.getOrbitControls(manager.camera, manager.getRenderer().domElement);
}

/** 创建地球球体 */
function createEarth() {
    const { radius } = meshBytesUtils.getHeader();

    const earthGeometry = new SphereGeometry(radius - 5, WIDTH_SEGMENTS, HEIGHT_SEGMENTS);
    const earthMaterial = new MeshBasicMaterial({
        color: EARTH_COLOR,
    });
    earth = new Mesh(earthGeometry, earthMaterial);
    // manager.axesHelper(earth, radius * 1.5);
    manager.scene.add(earth);
}

function crateLight() {
    const light = new DirectionalLight(0xffffff, 1);
    const ambiet = new AmbientLight(0xffffff, 1)
    light.position.copy(manager.camera.position);

    manager.scene.add(light, ambiet);
}

/** 注册canvas 事件 */
function registerCanvasEvent(canvas: HTMLCanvasElement) {}

/** 预处理地块 */
async function preprocessTiles() {
    const { tilesCount } = meshBytesUtils.getHeader();

    // 减少计算
    let accumFaceIndex = -1;
    let accumVertexIndex = -1;

    // const { minimapFaceTileMap, minimapTileVertexMap } = getMinimapDrawMap();
    // let minimapAccumFaceIndex = -1;
    // let minimapAccumVertexIndex = -1;

    // 预分区，包括网格和地图数据
    for (let i = 0; i < tilesCount; i++) {
        const { x, y, z, corners } = meshBytesUtils.getTileByIndex(i);

        // 预分区省id > 0和海洋 id < 0
        const pId = provBytesUtils.getProvByIndex(i)?.province;

        // 单个个多边形具有的三角面
        const corLen = corners.length;
        const faceCount = corLen === 6 ? 4 : 3;

        let _corLen = corLen;
        let _faceCount = faceCount;

        const tileVertexIndices: number[] = [];
        while (_corLen > 0) {
            tileVertexIndices.push(accumVertexIndex + _corLen);
            _corLen--;
        }
        TileVertexIndexMap.set(i, tileVertexIndices);
        accumVertexIndex += corLen;

        while (_faceCount > 0) {
            faceTileIndexMap.set(accumFaceIndex + _faceCount, i);
            _faceCount--;
        }
        accumFaceIndex += faceCount;

        // 通过睡眠 ease cpu 的计算
        if (i % 100000 === 0) {
            const per = Math.round((i / tilesCount) * 100);
            mapInitStatus.loadPercent = 0.5 * per;
            await sleep(0);
        }
    }
}

/** instance 处理地块 */
async function preprocessInstanceTiles() {
    const { tilesCount } = meshBytesUtils.getHeader();

    let firsttile5
}

async function drawLayer() {
    const { tilesCount, radius } = meshBytesUtils.getHeader();
    const tileGeoArr: BufferGeometry[] = [];

    for (let index = 0; index < tilesCount - 1000000; index++) {
        const { corners, x, y, z } = meshBytesUtils.getTileByIndex(index);
        const { type, elevation, waterElevation } = mapBytesUtils.getTileByIndex(index);
        const isLand = elevation > waterElevation;

        const vertices = corners.map<Coordinate>((v) => {
            const corner = meshBytesUtils.getCornerByIndex(v);
            return {
                x: corner.x,
                y: corner.y,
                z: -corner.z,
            };
        });

        const color = randomColor();

        tileGeoArr.push(
            createTileGeometry({
                vertices,
                isLand,
                textureId: type,
                center: { x, y, z: -z },
                radius,
                tileIndex: index,
                color,
                elevation,
            })
        );

        if (index % 10000 === 0) {
            const per = Math.round((index / tilesCount) * 100);
            mapInitStatus.loadPercent = 60 + 0.4 * per;
            await sleep(0);
        }
    }

    // 地块
    const tilesGeo = BufferGeometryUtils.mergeGeometries(tileGeoArr, false);

    // 普通材质
    const tilesMat = new CustomShaderMaterial({
        baseMaterial: MeshPhongMaterial,
        vertexColors: true,
        // 用于图层
        transparent: true,
        wireframe: true,
        vertexShader: /* glsl */`
            attribute float elevation;

            void main() {
                csm_Position += elevation * normal;
            }
        `,
        fragmentShader: /* glsl */`
            void main() {

            }
        `
    });

    // 不需要base，不渲染，节省内存
    // 基础图层，最底层图层，透明兜底
    // const base = new Mesh(tilesGeo, tilesMat);
    // base.renderOrder = RENDER_ORDER_BASE;
    // base.visible = false;

    // 地形图层，这里有点奇怪，base始终会覆盖到terrian上，待中出
    // 在切换图层时需特别处理

    const mesh = new Mesh(tilesGeo, tilesMat);

    manager.scene.add(mesh);
}

function randomColor(): XColor {
    return [Math.random(), Math.random(), Math.random(), 1.0];
}

/** 创建单个地块的几何体 */
export function createTileGeometry(op: {
    vertices: Coordinate[];
    isLand?: boolean;
    minimap?: boolean;
    textureId?: number;
    center?: Coordinate;
    radius?: number;
    isCliff?: boolean;
    tileIndex?: number;
    color?: XColor;
    elevation?: number;
}) {
    const geo = new BufferGeometry();
    const points: number[] = [];
    const colors: number[] = [];
    const elevations: number[] = [];
    // const normals: number[] = [];

    const { vertices, color, elevation } = op;

    const count = vertices.length
    const center: number[] = []

    let ax = 0, ay = 0, az = 0
    for (let i = 0; i < count; i++) {
        ax += vertices[i].x
        ay += vertices[i].y
        az += vertices[i].z
    }

    ax /= count;
    ay /= count
    az /= count

    // 增加顶点数量，增加细分
    for (let i = 0; i < count; i++) {
        const p = vertices[i]
        vertices.push({
            x: (p.x + ax) / 2,
            y: (p.y + ay) / 2,
            z: (p.z + az) / 2,
        })
    }

    // 加上中心
    vertices.push({ x: ax, y: ay, z: az })

    vertices.forEach((v) => {
        const { x, y, z } = v;
        points.push(x, y, z);

        colors.push(...color);
        elevations.push(elevation);
        // 法向量取中心和格子中心的连线
        // const normalsV3 = new Vector3(center.x, center.y, center.z).normalize();
        // normals.push(-normalsV3.x, -normalsV3.y, -normalsV3.z);
    });

    geo.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    // 这里为了节省内存，用的是 Unit8array，那么colors里的每个元素的范围是 0~255的整数
    // 这里包含了alpha通道，所以为 4
    geo.setAttribute("color", new BufferAttribute(new Float32Array(colors), 4));

    geo.setAttribute("elevation", new BufferAttribute(new Float32Array(elevations), 1));

    // geo.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
    if (count === 6) {
        // 六边形顶点索引，注意在自动计算法向量时，采用的右手定则
        // 三角面的顶点索引顺序使用右手定则，大拇指方向为方向为法向量方向
        // 麻痹的 unity 使用左手坐标系，反起转，操
        // geo.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4]); // 右手
        // geo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]); // 左手
        geo.setIndex([
            0, 1, 7,
            0, 7, 6,
            1, 2, 8,
            1, 8, 7,
            2, 3, 9,
            2, 9, 8,
            3, 4, 10,
            3, 10, 9,
            4, 11, 10,
            4, 5, 11,
            5, 6, 11,
            5, 0, 6,
            6, 7, 12,
            7, 8, 12,
            8, 9, 12,
            9, 10, 12,
            10, 11, 12,
            11, 6, 12
        ])
    } else {
        // 五边形顶点索引
        // geo.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3]); // 右手
        // geo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4]); // 左手
        geo.setIndex([
            0, 1, 6,
            0, 6, 5,
            1, 2, 7,
            1, 7, 6,
            2, 3, 8,
            2, 8, 7,
            3, 4, 9,
            3, 9, 8,
            4, 5, 9,
            4, 0, 5,
            5, 6, 10,
            6, 7, 10,
            7, 8, 10,
            8, 9, 10,
            9, 5, 10
        ])
    }

    geo.computeVertexNormals();

    return geo;
}

function render() {
    manager.loop(() => {
        // FPS = Math.round(1 / manager.getClock().getDelta());
        // if (Date.now() % 5 === 0) {
        //     // 减少计算
        //     setFPS(FPS);
        // }
        manager.resizeRendererToDisplaySize();

        getOrbitControls().update();

        // setIsolatedLinesResolution();

        // setLine2Resolution();

        // setWaypointPathResolution();

        // setSeaWaypointPathResolution();

        // setCliffEdgesResolution();

        // setRiverResolution();

        TWEEN.update();

        manager.getRenderer().render(manager.scene, manager.camera);
    });
}

/** 取消渲染循环，节约性能，通常用于在切换到其他非地图页面时 */
export function cancelRender() {
    if (!manager) return;

    manager.loop(null);
    // manager.scene.remove(mergedBorders);
    // manager.scene.remove(mergedTiles);

    // 这个暂时不销毁，留着复用
    // (mergedTiles.material as MeshBasicMaterial).dispose();
    // mergedTiles.geometry.dispose();
    // (mergedBorders.material as MeshBasicMaterial).dispose();
    // mergedBorders.geometry.dispose();

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
        render();
    }
}

export function getMapInitStatus() {
    return mapInitStatus;
}
