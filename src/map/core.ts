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
    LineSegments,
    Mesh,
    MeshPhongMaterial,
    PerspectiveCamera,
    Scene,
    SphereGeometry,
    Stats,
    TWEEN,
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
    InstancedBufferGeometry,
    InstancedMesh,
    Matrix4,
    Quaternion,
    MeshBasicMaterial,
    Group,
    MeshBVH,
} from "./three-manager";
import { getBytesUtils, readFileBase64, sleep } from "./utils";
import { LL2TID } from "./LL2TID";
import {
    CAMEARA_TO_EARTH_INIT_DIS,
    CAMEARA_TO_EARTH_MAX_DIS,
    CAMEARA_TO_EARTH_MIN_DIS,
    DEFAULT_TERRIAN,
    EDIT_ZOOM,
    HEIGHT_SEGMENTS,
    INIT_GISZONE,
    INIT_LAT_LNG,
    INIT_ZOOM,
    LAT_DIVIDER,
    LAT_SLICES,
    LNG_DIVIDER,
    LNG_SLICES,
    MAX_CLICKING_TIME,
    MAX_MOVE_DELTA_SQA,
    MAX_ZOOM,
    MIN_ZOOM,
    TILE_TEXTURE_ATLAS,
    TILE_TEXTURE_MAP,
    WIDTH_SEGMENTS,
    ZONE_KEY_POLAR_N,
    ZONE_KEY_POLAR_S,
    ZOOM_DIS,
    ZOOM_SPEED,
} from "./consts";
import { Coordinate, GISZone, GISZoneMap, GISZoneTileIndicesMap, MapInitStatus, UV, XColor } from "./types";

import tileFrag from "./shader/tile/frag.glsl";
import tileVert from "./shader/tile/vert.glsl";
import atmoFrag from "./shader/atmosphere/frag.glsl";
import atmoVert from "./shader/atmosphere/vert.glsl";

import { isEqual, throttle } from "lodash-es";
// import { CONTROL_STATE } from "./sphereOrbit";
import lensflare0 from "../assets/lensflare0.png";
import lensflare3 from "../assets/lensflare3.png";

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

/**
 * 分区内的所有格子索引 zonekey -> [0, 1, 2, 3, 4, ...]
 * 保存该该格子在全部格子下的索引
 * 数据初始化后不再改变
 */
const zoneTileIndicesMap: GISZoneTileIndicesMap = new Map();

const zoneMeshMap: Map<string, Mesh> = new Map();

const zoneMeshGroup = new Group();

/** 当前分区 tileindex -> vertex[] */
const curTileVertexIndexMap: Map<number, number[]> = new Map();

/** 当前分区 faceIndex -> tileIndex */
const curfaceTileIndexMap: Map<number, number> = new Map();

/** 当前分区所有的格子，由于这个值用的非常频繁，保存下来 */
let curTileIndices: number[] = null;

let curTileLayer: Mesh = null;

let lastCurTileLayer: Mesh = null;

/** 分区格子边界 */
let curTileEdge: LineSegments = null;

/** 所有 tileindex -> vertex[] */
const TileVertexIndexMap: Map<number, number[]> = new Map();

/** 所有 faceIndex -> tileIndex */
const faceTileIndexMap: Map<number, number> = new Map();

/** tileindex -> uv[] */
const tileIndexUVMap: Map<number, number[]> = new Map();

/** 地图初始化状态 */
const mapInitStatus: MapInitStatus = { loadPercent: 0 };

// const time = new Uniform(0);

let stats: Stats = null;

/** 自定义当前的缩放层级 */
let zoom = INIT_ZOOM;

/**
 * 当前分区坐标，可以同时显示多个zone
 * 如果是南北分区就取第一个放进去
 */
let gisZones: GISZoneMap = {};

let controlChanging = false;

let globalMesh: Mesh = null;

/** 是否位于低轨道 */
let isLowHeight = false;

/** 全局纹理，复用 */
let globalTexture: Texture = null;

/** 光源轨道 */
let sunOrbit: Spherical = null;
/** 平行光 */
let dirLight: DirectionalLight = null;
/** 点光，用于光斑形成 */
let pointLight: PointLight = null;

let isPointerDown = false;

/** uniform 变量，将传入到shader里 */
const uniforms = {
    /** 光源方向 */
    uSunDir: new Uniform(new Vector3(0, 0, 1)),
    /** 大气层白天颜色 */
    uAtmDay: new Uniform(new Color("#00aaff")),
    /** 大气层晨昏颜色 */
    uAtmTwilight: new Uniform(new Color("#ff6600")),
    /** 输入纹理 */
    uTexture: new Uniform<Texture>(null),
    /** 是否使用纯色着色，忽略纹理 */
    uPureColor: new Uniform(true),
};

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

    stats = new Stats();

    mapInitStatus.loadPercent = 10;

    // 相机
    createCamerea();

    // createEarth();

    createLight();

    onCanvasEvent(manager.getRenderer().domElement);

    // await preprocessInstanceTiles();

    await preprocessTiles();

    await drawAllZoneMesh();

    // await drawLayer();

    // await drawVirtualZone();

    mapInitStatus.loadPercent = 100;
}

/** 初始化相机 */
function createCamerea() {
    const { radius, cornersCount } = meshBytesUtils.getHeader();
    // 重置顶点数量，非常重要
    getLL2TID().CornerTop = cornersCount;

    earthRadius = radius;

    // 相机
    manager.camera = new PerspectiveCamera(50, 1, 0.1, radius * 5);

    manager.camera.position.set(0, 0, radius + CAMEARA_TO_EARTH_INIT_DIS);

    const control = getOrbitControls();

    // control.enableDamping = true;
    control.enablePan = false;
    control.maxDistance = radius + CAMEARA_TO_EARTH_MAX_DIS;
    control.minDistance = radius + CAMEARA_TO_EARTH_MIN_DIS;

    control.mouseButtons = {
        LEFT: MOUSE.ROTATE,
    };

    setChangedControl(false);

    registerControlEvent();
}

function cameraControlChanging() {
    controlChanging = true;
    needsUpdateWhenControlChanging();

    setTiltCamera();
}

function setTiltCamera() {
    const controls = getOrbitControls();
    const minDis = ZOOM_DIS.get(EDIT_ZOOM);
    const pos = manager.camera.position;
    const dis = pos.length() - earthRadius;

    if (dis < minDis) {
        const angle =
            controls._tiltMaxAngle * (1 - (dis - CAMEARA_TO_EARTH_MIN_DIS) / (minDis - CAMEARA_TO_EARTH_MIN_DIS));

        if (!isLowHeight) {
            controls.minDistance = CAMEARA_TO_EARTH_MIN_DIS;
            controls.target.copy(pos.clone().normalize().multiplyScalar(earthRadius));
            controls.setIsTiltZoom(true);

            controls.enablePan = true;
            controls.enableRotate = false;
            controls.mouseButtons = {
                LEFT: MOUSE.PAN,
            };

            isLowHeight = true;
            uniforms.uPureColor.value = false;

            // 重要，更新前更新倾角
            controls.setCameraOrthTiltAngle(angle);

            controls.update();
        }

        controls.setCameraOrthTiltAngle(angle);
    } else {
        if (isLowHeight) {
            controls.target.copy(new Vector3(0, 0, 0));
            controls.setIsTiltZoom(false);

            controls.enablePan = false;
            controls.enableRotate = true;
            controls.mouseButtons = {
                LEFT: MOUSE.ROTATE,
            };

            isLowHeight = false;
            uniforms.uPureColor.value = true;

            controls.update();
        }
    }
}

function cameraControlChanged() {
    controlChanging = false;
    needsUpdateAfterControlChanged();
}

/** 一些需要 在相机控制器改变时的操作放这里 */
function needsUpdateWhenControlChanging() {
    setChangingControl();
}

/** 一些需要 在相机控制器改结束后的操作放这里 */
function needsUpdateAfterControlChanged() {
    setChangedControl();
}

/** 注册控件事件 */
function registerControlEvent() {
    const control = getOrbitControls();

    control.addEventListener("change", cameraControlChanging);

    control.addEventListener("end", throttle(cameraControlChanged, 100, { trailing: true }));
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

function createEarth() {
    const { radius } = meshBytesUtils.getHeader();

    const earthGeometry = new SphereGeometry(radius - 5, WIDTH_SEGMENTS, HEIGHT_SEGMENTS);
    const earthMaterial = new MeshBasicMaterial({
        color: 0xffffff,
    });
    earth = new Mesh(earthGeometry, earthMaterial);
    manager.scene.add(earth);
}

function createLight() {
    dirLight = new DirectionalLight(0xffffff, 2);
    const ambiet = new AmbientLight(0xffffff, 2);
    dirLight.position.copy(manager.camera.position);

    // 光晕
    const loader = manager.getTextureLoader();
    const lens0 = loader.load(lensflare0);
    const lens3 = loader.load(lensflare3);

    pointLight = new PointLight(0xffffff, 2, 2000, 0);
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

    manager.scene.add(dirLight, ambiet, pointLight);

    createAtmosphere();
}

function udpateLight(elapsed: number) {
    if (!sunOrbit || !pointLight || !dirLight) return;

    sunOrbit.theta = elapsed * 0.5;
    const v = new Vector3();
    // 使用轨道位置
    // v.setFromSpherical(sunOrbit);
    // 使用相机位置，保证始终朝向灯光
    v.copy(manager.camera.position);
    pointLight.position.copy(v);
    dirLight.position.copy(v);

    uniforms.uSunDir.value.copy(v.normalize());
}

function createAtmosphere() {
    const atm = new Mesh(
        new SphereGeometry(earthRadius, WIDTH_SEGMENTS, HEIGHT_SEGMENTS),
        new CustomShaderMaterial({
            baseMaterial: MeshPhongMaterial,
            // 技巧，显示背面，剔除正面
            side: BackSide,
            transparent: true,
            uniforms: uniforms,
            vertexShader: atmoVert,
            fragmentShader: atmoFrag,
        })
    );

    // 稍微放大
    atm.scale.set(1.06, 1.06, 1.06);

    manager.scene.add(atm);
}

/** 监听canvas 事件 */
function onCanvasEvent(canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
}

function pointerDown(e: PointerEvent) {
    isPointerDown = true;

    mapClickStartTime = performance.now();
    const pos = manager.getCanvasRP(e);
    mapClickStartPos.x = pos.x;
    mapClickStartPos.y = pos.y;
}

function pointerMove(e: PointerEvent) {
    getLatlng(e);
}

function pointerUp(e: PointerEvent) {
    isPointerDown = false;
}

function getLatlng(e: PointerEvent) {
    return
    const ndc = manager.getCanvasNP(e);
    const intersect = manager.picker([zoneMeshGroup], ndc, true);
    if (intersect == null) return;
    const point = intersect.point;
    // const point = manager.getIntersectOfRay(earthRadius, ndc);
    if (!point) return;

    const latlng = manager.vector3ToLatLng(point);
    const tileIndex = getLL2TID().LLConvertPos(-latlng.lng, latlng.lat);
}

/** 预处理地块 */
async function preprocessTiles() {
    const { tilesCount } = meshBytesUtils.getHeader();

    // 减少计算
    let accumFaceIndex = -1;
    let accumVertexIndex = -1;

    // 预分区，包括网格和地图数据
    for (let i = 0; i < tilesCount; i++) {
        const { x, y, z, corners } = meshBytesUtils.getTileByIndex(i);
        const zone = getZoneByPoint(new Vector3(x, y, -z));
        if (!zone) continue;

        const key = getZoneKey(zone, true);
        const tiles = zoneTileIndicesMap.get(key);

        if (!tiles) {
            zoneTileIndicesMap.set(key, [i]);
        } else {
            tiles.push(i);
        }

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

/** 获取地块的 uv 坐标 */
function getTileUV(tileIndex: number) {
    const { type, elevation, waterElevation } = mapBytesUtils.getTileByIndex(tileIndex);
    const { x, y, z, corners } = meshBytesUtils.getTileByIndex(tileIndex);
    const center = new Vector3(x, y, -z);
    const north = calcVertexPositiveDir(center, earthRadius);

    let tId = type;

    if (elevation <= waterElevation) {
        tId = 40;
    }

    const uvSpan = getTextureUVSpan(tId);
    const { leftU, bottomV, deltaU, deltaV } = uvSpan;

    const centerU = leftU + deltaU / 2;
    const centerV = bottomV + deltaV / 2;

    const uvs: number[] = [];

    corners.forEach((v) => {
        const { x, y, z } = meshBytesUtils.getCornerByIndex(v);
        const uv = calcVertexUV([leftU, bottomV], deltaU, deltaV, new Vector3(x, y, -z), center, north);
        uvs.push(...uv);
    });

    const lerpUV: number[] = [];
    // 插值 uv
    for (let i = 0; i < uvs.length; i += 2) {
        const u = uvs[i];
        const v = uvs[i + 1];
        lerpUV.push((centerU + u) / 2, (centerV + v) / 2);
    }
    lerpUV.push(centerU, centerV);

    uvs.push(...lerpUV);

    return uvs;
}

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
 * 渲染所有分区对应的网格，这种比merge geometry 更实惠
 *
 * 占据更少的内存，但会多一些drawcall
 */
async function drawAllZoneMesh() {
    await loadGlobalTexture();

    manager.scene.add(zoneMeshGroup);

    let count = 0;
    const size = zoneTileIndicesMap.size;

    for (const [zone, tiles] of zoneTileIndicesMap) {
        const geoArr: BufferGeometry[] = [];
        for (let i = 0, len = tiles.length; i < len; i++) {
            const index = tiles[i];

            const { corners, x, y, z } = meshBytesUtils.getTileByIndex(index);
            const { type, elevation, waterElevation } = mapBytesUtils.getTileByIndex(index);

            const vertices = corners.map<Coordinate>((v) => {
                const corner = meshBytesUtils.getCornerByIndex(v);
                return {
                    x: corner.x,
                    y: corner.y,
                    z: -corner.z,
                };
            });

            const uvs = getTileUV(index);
            // tileIndexUVMap.set(index, uvs)

            const color = randomColor();

            geoArr.push(
                createComplexTileGeometry({
                    vertices,
                    center: { x, y, z: -z },
                    color,
                    elevation,
                    waterElevation,
                    type,
                    tileIndex: index,
                    uvs,
                })
            );
        }

        const geo = BufferGeometryUtils.mergeGeometries(geoArr, false);
        geo.boundsTree = new MeshBVH(geo);

        const mat = new CustomShaderMaterial({
            baseMaterial: MeshPhongMaterial,
            // vertexColors: true,
            // transparent: true,
            // wireframe: true,
            uniforms,
            vertexShader: tileVert,
            fragmentShader: tileFrag,
        });

        const mesh = new Mesh(geo, mat);
        zoneMeshGroup.add(mesh);
        zoneMeshMap.set(zone, mesh);

        {
            // 更新顶点
            // 选择在这里更新顶点而不是着色器，是因为
            // raycast只认geometry的顶点，我操
            const posAttr = geo.getAttribute("position");
            const noramlAttr = geo.getAttribute("normal");
            const colorMixAttr = geo.getAttribute("colorMix");
            const vertCount = posAttr.count;
            for (let i = 0; i < vertCount; i++) {
                let colorMix = colorMixAttr.getX(i);
                if (colorMix < 0.001) colorMix = 0;

                const x = posAttr.getX(i) + colorMix * noramlAttr.getX(i);
                const y = posAttr.getY(i) + colorMix * noramlAttr.getY(i);
                const z = posAttr.getZ(i) + colorMix * noramlAttr.getZ(i);

                posAttr.setX(i, x);
                posAttr.setY(i, y);
                posAttr.setZ(i, z);
            }

            posAttr.needsUpdate = true;

            // 重新生成geometry顶点后必须重新构建bvh，否则不能
            // 获得正确的射线交点
            geo.boundsTree = new MeshBVH(geo);
        }

        if (count % 1 === 0) {
            const per = Math.round((count / size) * 100);
            mapInitStatus.loadPercent = 60 + 0.4 * per;
            await sleep(0);
        }

        count++;
    }
}

/** instance 处理地块 */
async function preprocessInstanceTiles() {
    const { tilesCount } = meshBytesUtils.getHeader();

    let first5Geometry: InstancedBufferGeometry = null;
    let first5Center: Vector3 = null;
    let first5Mesh: InstancedMesh = null;
    let first6Geometry: InstancedBufferGeometry = null;
    let first6Center: Vector3 = null;
    let first6Mesh: InstancedMesh = null;

    for (let i = 0; i < tilesCount; i++) {
        const { x, y, z, corners } = meshBytesUtils.getTileByIndex(i);

        const vertices = corners.map<Coordinate>((v) => {
            const corner = meshBytesUtils.getCornerByIndex(v);
            return {
                x: corner.x,
                y: corner.y,
                z: -corner.z,
            };
        });

        const color = randomColor();

        const points: number[] = [
            // 12, 0, 0,
            // 12, 12, 0,
            // -12, 12, 0,
            // -12, -12, 0,
            // 0, -12, 0,
            // 12, 12, 12
        ];
        const colors: number[] = [];
        vertices.forEach((v) => {
            points.push(v.x, v.y, v.z);
            colors.push(...color);
        });

        if (!first5Geometry && corners.length === 5) {
            first5Geometry = new InstancedBufferGeometry();
            first5Geometry.instanceCount = 12;
            first5Geometry.setAttribute("position", new Float32BufferAttribute(points, 3));

            // first5Geometry.setAttribute("color", new InstancedBufferAttribute(new Float32Array(colors), 4));

            first5Geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4]);
            // first5Geometry.translate(-x, -y, z)

            // first5Geometry = new SphereGeometry(3, 3, 3)
            // first5Geometry = new PlaneGeometry(3, 3, 1, 2);
            // first5Geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 4));

            first5Center = new Vector3(x, y, -z).normalize();

            first5Mesh = new InstancedMesh(
                first5Geometry,
                new MeshPhongMaterial({
                    // vertexColors: true,
                    // transparent: true,
                    color: 0xff0000,
                    wireframe: true,
                }),
                12
            );
        }

        if (!first6Geometry && corners.length === 6) {
            first6Geometry = new InstancedBufferGeometry();
            first6Geometry.instanceCount = tilesCount - 12;
            first6Geometry.setAttribute("position", new Float32BufferAttribute(points, 3));

            // first6Geometry.setAttribute("color", new InstancedBufferAttribute(new Float32Array(colors), 4));
            first6Geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
            // first6Geometry.translate(-x, -y, z)

            // first6Geometry = new SphereGeometry(2, 3, 3)
            // first6Geometry = new PlaneGeometry(3, 3, 1, 2);
            // first6Geometry.setAttribute("color", new InstancedBufferAttribute(new Float32Array(colors), 4));

            first6Center = new Vector3(x, y, -z).normalize();

            first6Mesh = new InstancedMesh(
                first6Geometry,
                new CustomShaderMaterial({
                    baseMaterial: MeshPhongMaterial,
                    // vertexColors: true,
                    // transparent: true,
                    color: 0xff0000,
                    wireframe: true,
                    vertexShader: /* glsl */ `
                        // uniform float time;
                        // void main() {
                        //     int a = gl_InstanceID;
                        //     if (mod(float(a), 4.0) == 0.) {
                        //         csm_Position.y += sin(csm_Position.x + time + float(a)) * 100.0;
                        //     }
                        // }
                    `,
                    uniforms: {
                        // time,
                    },
                }),
                tilesCount - 12
            );

            // first6Mesh.scale.set(10, 10, 10)
        }

        if (first5Geometry && first6Geometry) break;
    }

    let p5 = 0,
        p6 = 0;

    const f = new Vector3(0, 0, 1);

    if (first5Geometry && first6Geometry) {
        for (let i = 0; i < 500; i++) {
            const { x, y, z, corners } = meshBytesUtils.getTileByIndex(i);
            const matrix = new Matrix4();
            const pos = new Vector3(x, y, -z);
            const color = randomColor();
            if (corners.length === 5) {
                // matrix.setPosition(pos)
                // matrix.makeRotationFromQuaternion(new Quaternion().random())
                matrix.compose(
                    new Vector3(0, 0, 0),
                    new Quaternion().setFromUnitVectors(first5Center, new Vector3(x, y, -z).normalize()),
                    new Vector3(1, 1, 1)
                );
                first5Mesh.setMatrixAt(p5, matrix);
                // first5Mesh.setColorAt(p5, new Color());
                p5++;
            } else {
                // matrix.setPosition(pos)
                // matrix.makeRotationFromQuaternion(new Quaternion().random())
                matrix.compose(
                    new Vector3(0, 0, 0),
                    new Quaternion().setFromUnitVectors(first6Center, new Vector3(x, y, -z).normalize()),
                    new Vector3(1, 1, 1)
                );
                first6Mesh.setMatrixAt(p6, matrix);
                p6++;
            }

            if (i % 100000 === 0) {
                const per = Math.round((i / tilesCount) * 100);
                mapInitStatus.loadPercent = 0.5 * per;
                await sleep(0);
            }
        }
    }

    manager.scene.add(first5Mesh, first6Mesh);
}

async function drawLayer() {
    if (globalMesh) return;

    const { tilesCount, radius } = meshBytesUtils.getHeader();
    const geometryArray: BufferGeometry[] = [];

    let tid = 0;

    // 先生成材质复用
    const image = new Image();
    let src = await readFileBase64();
    src = `data:image/png;base64,${src}`;
    image.src = src;

    const texture = new Texture(image);
    texture.colorSpace = SRGBColorSpace;
    image.onload = () => (texture.needsUpdate = true);

    globalTexture = texture;

    for (let index = 0; index < tilesCount; index++) {
        const { corners, x, y, z } = meshBytesUtils.getTileByIndex(index);
        const { type, elevation, waterElevation } = mapBytesUtils.getTileByIndex(index);
        // const isLand = elevation > waterElevation;

        if (elevation < waterElevation) {
            tid = 40;
        } else {
            tid = type;
        }

        const cv = new Vector3(x, y, -z);
        const n = calcVertexPositiveDir(cv, radius);

        const uvSpan = getTextureUVSpan(tid);
        const { leftU, bottomV, deltaU, deltaV } = uvSpan;

        const centerU = leftU + deltaU / 2;
        const centerV = bottomV + deltaV / 2;

        const uvs: number[] = [];

        const vertices = corners.map<Coordinate>((v) => {
            const { x, y, z } = meshBytesUtils.getCornerByIndex(v);
            const uv = calcVertexUV([leftU, bottomV], deltaU, deltaV, new Vector3(x, y, -z), cv, n);
            uvs.push(...uv);
            return {
                x,
                y,
                z: -z,
            };
        });

        const lerpUV: number[] = [];
        // 插值 uv
        for (let i = 0; i < uvs.length; i += 2) {
            const u = uvs[i];
            const v = uvs[i + 1];
            lerpUV.push((centerU + u) / 2, (centerV + v) / 2);
        }
        lerpUV.push(centerU, centerV);

        uvs.push(...lerpUV);

        tileIndexUVMap.set(index, uvs);

        const color = randomColor();

        const geometry = createTileGeometry({
            vertices,
            tileIndex: index,
            color,
            elevation,
            waterElevation,
        });

        geometryArray.push(geometry);

        if (index % 10000 === 0) {
            const per = Math.round((index / tilesCount) * 100);
            mapInitStatus.loadPercent = 60 + 0.4 * per;
            await sleep(0);
        }
    }

    {
        // 这种方式可以大量减少使用的顶点达到降低内存占用
        // 但是无法单独控制地块的颜色，因为顶点被多个地块
        // 共用，插值会产生渐变，我草泥马
        // const positions: number[] = []
        // const colors: number[] = []
        // const index: number[] = []
        // const color2 = randomColor()
        // const color3 = randomColor()
        // for (let i = 0; i < cornersCount; i++) {
        //     const { x, y, z } = meshBytesUtils.getCornerByIndex(i);
        //     positions.push(x, y, -z)
        // }
        // for (let i = 0; i < tilesCount; i++) {
        //     const { corners } = meshBytesUtils.getTileByIndex(i);
        //     let color: XColor = null;
        //     if (i % 10 === 0) {
        //         color = color2
        //     } else {
        //         color = color3
        //     }
        //     const [v0, v1, v2, v3, v4, v5] = corners
        //     corners.forEach(v => {
        //         const v4 = v * 4;
        //         colors[v4]= color[0]
        //         colors[v4 + 1]= color[1]
        //         colors[v4 + 2]= color[2]
        //         colors[v4 + 3]= color[3]
        //     })
        //     const length = corners.length
        //     if (length === 5) {
        //         index.push(v0, v1, v2, v0, v2, v3, v0, v3, v4)
        //     } else {
        //         index.push(v0, v1, v2, v0, v2, v3, v0, v3, v4, v0, v4, v5)
        //     }
        // }
        // const geometry = new BufferGeometry()
        // geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3))
        // geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 4))
        // geometry.setIndex(index)
        // // geometry.computeVertexNormals()
        // const material = new CustomShaderMaterial({
        //     baseMaterial: MeshPhongMaterial,
        //     vertexColors: true,
        //     transparent: true,
        //     // color: 0xff0000,
        //     wireframe: true
        // })
        // const mesh = new Mesh(geometry, material)
        // manager.scene.add(mesh)
        // reture;
    }

    // 合并地块，减少 drawcall
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometryArray, false);

    // 普通材质
    const material = new CustomShaderMaterial({
        baseMaterial: MeshPhongMaterial,
        vertexColors: true,
        // 用于图层
        transparent: true,
        // color: 0xff0000,
        // wireframe: true,
        uniforms: uniforms,
        vertexShader: tileVert,
        fragmentShader: tileFrag,
    });

    // 不需要base，不渲染，节省内存
    // 基础图层，最底层图层，透明兜底
    // const base = new Mesh(mergedGeometry, material);
    // base.renderOrder = RENDER_ORDER_BASE;
    // base.visible = false;

    // 地形图层，这里有点奇怪，base始终会覆盖到terrian上，待中出
    // 在切换图层时需特别处理

    globalMesh = new Mesh(mergedGeometry, material);

    manager.scene.add(globalMesh);
}

function randomColor(): XColor {
    return [Math.random(), Math.random(), Math.random(), 1.0];
}

/** 创建单个地块的几何体 */
export function createTileGeometry(op: {
    vertices: Coordinate[];
    tileIndex?: number;
    color?: XColor;
    elevation: number;
    waterElevation: number;
}) {
    const geometry = new BufferGeometry();
    const points: number[] = [];
    // const colors: number[] = [];
    const colorMix: number[] = [];

    const { vertices, elevation, waterElevation } = op;

    const count = vertices.length;

    vertices.forEach((v) => {
        const { x, y, z } = v;
        points.push(x, y, z);
        // colors.push(...color);
        colorMix.push(elevation - waterElevation);
    });

    geometry.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    // geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 4));
    geometry.setAttribute("colorMix", new BufferAttribute(new Float32Array(colorMix), 1));

    if (count === 6) {
        // 六边形顶点索引，注意在自动计算法向量时，采用的右手定则
        // 三角面的顶点索引顺序使用右手定则，大拇指方向为方向为法向量方向
        // 麻痹的 unity 使用左手坐标系，反起转，操
        // geometry.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4]); // 右手
        geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]); // 左手
    } else {
        // 五边形顶点索引
        // geometry.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3]); // 右手
        geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4]); // 左手
    }

    geometry.computeVertexNormals();

    return geometry;
}

/** 细分更多的结构 */
export function createComplexTileGeometry(op: {
    vertices: Coordinate[];
    center: Coordinate;
    tileIndex?: number;
    color?: XColor;
    elevation?: number;
    waterElevation?: number;
    type?: number;
    uvs?: number[];
}) {
    const geometry = new BufferGeometry();
    const points: number[] = [];
    // const colors: number[] = [];
    const elevations: number[] = [];
    const colorMix: number[] = [];

    const { vertices, center, elevation, waterElevation, uvs } = op;

    const count = vertices.length;

    // const { x, y, z } = center;

    // 增加顶点数量，增加细分，直接取顶点到中心的中点
    for (let i = 0; i < count; i++) {
        const v = vertices[i];
        vertices.push({
            // x: mixValue(v.x, x, 0.5),
            // y: mixValue(v.y, y, 0.5),
            // z: mixValue(v.z, z, 0.5),
            x: v.x,
            y: v.y,
            z: v.z,
        });
    }

    // 加上中心
    vertices.push(center);

    const diff = elevation - waterElevation;

    vertices.forEach((v, i) => {
        const { x, y, z } = v;
        points.push(x, y, z);
        colorMix.push(diff);
        // const noraml = new Vector3(x, y, z).normalize();

        if (i < count) {
            // points.push(x, y, z);
            elevations.push(0);
        } else {
            // 修改顶点
            // points.push(x + diff * noraml.x, y + diff * noraml.y, z + noraml.z);
            elevations.push(elevation);
        }
    });

    geometry.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    // geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 4));
    geometry.setAttribute("elevation", new BufferAttribute(new Float32Array(elevations), 1));
    geometry.setAttribute("colorMix", new BufferAttribute(new Float32Array(colorMix), 1));
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));

    if (count === 6) {
        // 正六边形再次细分为18个三角面
        geometry.setIndex([
            0, 1, 7, 0, 7, 6, 1, 2, 8, 1, 8, 7, 2, 3, 9, 2, 9, 8, 3, 4, 10, 3, 10, 9, 4, 11, 10, 4, 5, 11, 5, 6, 11, 5,
            0, 6, 6, 7, 12, 7, 8, 12, 8, 9, 12, 9, 10, 12, 10, 11, 12, 11, 6, 12,
        ]);
    } else {
        // 正五边形细分为15个三角面
        geometry.setIndex([
            0, 1, 6, 0, 6, 5, 1, 2, 7, 1, 7, 6, 2, 3, 8, 2, 8, 7, 3, 4, 9, 3, 9, 8, 4, 5, 9, 4, 0, 5, 5, 6, 10, 6, 7,
            10, 7, 8, 10, 8, 9, 10, 9, 5, 10,
        ]);
    }

    geometry.computeVertexNormals();

    return geometry;
}

function render() {
    manager.loop(() => {
        manager.resizeRendererToDisplaySize();

        TWEEN.update();

        stats?.update();

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
        document.body.appendChild(stats.dom);
        render();
    }
}

export function getMapInitStatus() {
    return mapInitStatus;
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

/**
 * 获取当前 分区key string，特殊处理极地区域的 zonekey 务必通过此方法获取 key
 * @param ignorePolar 如果为 true 将忽略掉合并分区，只考虑单个分区
 */
export function getZoneKey(zone: GISZone, ignorePolar?: boolean) {
    const [lat] = zone;

    if (isPolarZone(zone) && !ignorePolar) {
        if (lat > LAT_SLICES / 2) {
            return ZONE_KEY_POLAR_N;
        } else {
            return ZONE_KEY_POLAR_S;
        }
    }

    return JSON.stringify(zone);
}

/** 是否是两极区域 */
export function isPolarZone(zone: GISZone) {
    const [lat] = zone;
    // 注意 lat cong 南极到北极 从 1开始
    if (lat === 1 || lat === LAT_SLICES) return true;

    return false;
}

async function drawVirtualZone() {
    const { radius } = meshBytesUtils.getHeader();

    let center: Vector3 = null;
    let zone: GISZone = null;

    if (INIT_LAT_LNG) {
        center = manager.latLngToVector3(INIT_LAT_LNG.lat, INIT_LAT_LNG.lng, radius);
        zone = getZoneByPoint(center);
    } else {
        zone = INIT_GISZONE;
        const { lat, lng } = getZoneBox(zone).center;
        center = manager.latLngToVector3(lat, lng, radius);
    }

    const zones = { [getZoneKey(zone)]: zone };

    // 初始化分区
    await setZones(zones, center);
}

/**
 * 这里会根据距离来调整旋转缩放的速度
 * @param needsZonesUpdate zones 是否需要更新 default = true
 */
async function setChangedControl(needsZonesUpdate = true) {
    if (!manager || !needsZonesUpdate) return;
    const pos = manager.camera.position;
    // 基于新位置需要更新分区
    const zone = getZoneByPoint(pos);
    await setZones({ [getZoneKey(zone)]: zone });
}

function setChangingControl() {
    if (!manager) return;

    const pos = manager.camera.position;
    const dis = pos.length();
    const control = getOrbitControls();

    // control 的改变同样会影响 zoom
    let _zoom = MAX_ZOOM;

    while (_zoom > 0) {
        if (dis - earthRadius <= ZOOM_DIS.get(_zoom)) {
            zoom = _zoom;
            break;
        }
        _zoom--;
    }

    // 控制缩放的速度和旋转的速度
    const speed = ZOOM_SPEED.get(zoom);

    if (speed && !isLowHeight) {
        control.rotateSpeed = speed;
        control.zoomSpeed = speed * 3.6;
    } else if (isLowHeight) {
        control.rotateSpeed = 1;
        control.zoomSpeed = 2;
        control.panSpeed = 0.006;
        // 靠近极地 0.5
        // 靠近赤道 0.005
        // const y = control.target.y;

        // control.panSpeed = mixValue(0.5, 0.005, 1 - Math.abs(y) / earthRadius);
    }
}

/** 设置缩放 */
export function setZoom(_zoom: number) {
    if (_zoom > MAX_ZOOM) {
        _zoom = MAX_ZOOM;
    }
    if (_zoom < MIN_ZOOM) {
        _zoom = MIN_ZOOM;
    }

    if (_zoom === zoom) return;

    zoom = _zoom;

    const dis = ZOOM_DIS.get(zoom);
    if (!dis) return;

    const ts = dis + meshBytesUtils.getHeader().radius;
    const position = manager.camera.position;

    const des = manager.calcCollinearVector(position, ts);

    // zoom 的改变会影响 control
    // zoom 不涉及球体旋转，不使用球面插值动画
    manager.createCameraTween(position, des).onComplete(() => {
        setChangedControl();
    });
}

/**
 * 是否是在点击画布，由于点击事件同时会触发 control的事件，
 * 在这里做一个区分，如果用户点击的时间很短，并且鼠标移动
 * 了很短的距离，认为用户只是在点击，而不是在拖拽地图
 */
export function isClickCanvas() {
    if (
        mapClickEndTime - mapClickStartTime < MAX_CLICKING_TIME &&
        (mapClickEndPos.x - mapClickStartPos.x) ** 2 + (mapClickEndPos.y - mapClickStartPos.y) ** 2 < MAX_MOVE_DELTA_SQA
    ) {
        return true;
    }

    return false;
}

/**
 * 设置当前分区，注意销毁之前的分区，创建新的分区
 * @param pos 相机移动到的位置
 */
export async function setZones(zones: GISZoneMap, pos?: Vector3) {
    return;
    if (zoom < EDIT_ZOOM) {
        beforeZonesChange();

        if (zones && Object.keys(zones).length > 0) {
            await panToPos(pos);
        }

        removeZones();
        gisZones = null;
        return;
    }

    if (!zones || Object.keys(zones).length === 0) return;

    // 一定要先移动相机再计算可见分区，否则不准确
    await panToPos(pos);

    const visibleZones = getVisibleZones(zones);
    // 如果分区相同，不刷新分区
    if (isEqualZones(visibleZones, gisZones)) return;
    // 如果分区是包含关系，放大不刷新分区
    if (isParentZones(gisZones, visibleZones)) return;

    // isZonesChanging = true;

    // updateCenterBox();

    // switchMapMask(true);

    beforeZonesChange();

    await afterZonesChange(visibleZones);

    // isZonesChanging = false;

    // switchMapMask(false);
}

/**
 * zones 改变之后
 * @param force 如果为 true，会强制重新获取新的数据
 * 通常数据在分区更改之后不会被销毁
 */
async function afterZonesChange(zones: GISZoneMap) {
    // 绘制新的
    await drawZones(zones);
}

/** 绘制分区 */
async function drawZones(zones: GISZoneMap) {
    if (!zones) return;
    // lastCurTileLayer = curTileLayer;
    // removeZones();
    // 重新赋值
    gisZones = zones;

    curTileIndices = null;

    curTileVertexIndexMap.clear();
    curfaceTileIndexMap.clear();

    const tileIndices = getZonesTileIndices(zones);

    if (!tileIndices) return;

    // 这两个量用的比较频繁，先保存下来
    curTileIndices = tileIndices;

    if (tileIndices.length === 0) return;
    const zoneTilesGeoArray: BufferGeometry[] = [];
    // const zoneEdgeGeoArray: BufferGeometry[] = [];

    // 预先分配好，减少计算
    let accumFaceIndex = -1;
    let accumVertexIndex = -1;

    // 需要注意的是 unity 使用左后坐标系，z轴垂直屏幕向内
    // threejs 使用右手坐标系，z轴垂直屏幕朝外
    // 所有在 threejs 坐标系内使用 unity 坐标，需要把 z取反
    for (let i = 0, len = tileIndices.length; i < len; i++) {
        const index = tileIndices[i];

        const { corners, x, y, z } = meshBytesUtils.getTileByIndex(index);
        const { type, elevation, waterElevation } = mapBytesUtils.getTileByIndex(index);

        // 注意更多的细分
        const corLen = corners.length === 6 ? 12 : 11;
        const faceCount = corLen === 12 ? 18 : 15;
        let _corLen = corLen;
        let _faceCount = faceCount;

        const tileVertexIndices: number[] = [];
        while (_corLen > 0) {
            tileVertexIndices.push(accumVertexIndex + _corLen);
            _corLen--;
        }
        curTileVertexIndexMap.set(index, tileVertexIndices);
        accumVertexIndex += corLen;

        while (_faceCount > 0) {
            curfaceTileIndexMap.set(accumFaceIndex + _faceCount, index);
            _faceCount--;
        }
        accumFaceIndex += faceCount;

        const vertices = corners.map<Coordinate>((v) => {
            const corner = meshBytesUtils.getCornerByIndex(v);
            return {
                x: corner.x,
                y: corner.y,
                z: -corner.z,
            };
        });

        // const { isCliff, cliffEdges } = getTileTerrianType(index);

        // concatSetUnion(curCliffEdges, cliffEdges);

        const color = randomColor();

        zoneTilesGeoArray.push(
            createComplexTileGeometry({
                vertices,
                center: { x, y, z: -z },
                color,
                elevation,
                waterElevation,
                type,
                tileIndex: index,
            })
        );

        // 通过睡眠 ease cpu 的计算
        if (i % 5000 === 0) {
            await sleep(0);
        }
    }

    // createCliffEdgeLines();

    // 地块
    const tilesGeo = BufferGeometryUtils.mergeGeometries(zoneTilesGeoArray, false);
    // tilesGeo.boundsTree = new MeshBVH(tilesGeo);

    // 普通材质
    const tilesMat = new CustomShaderMaterial({
        baseMaterial: MeshPhongMaterial,
        // vertexColors: true,
        // transparent: true,
        // wireframe: true,
        uniforms: {
            uTexture: { value: globalTexture },
        },
        vertexShader: tileVert,
        fragmentShader: tileFrag,
    });

    curTileLayer = new Mesh(tilesGeo, tilesMat);
    manager.scene.add(curTileLayer);
    removeZones();
    lastCurTileLayer = curTileLayer;
}

/**
 * 获取分区内的格子索引，包括极点区域的 所有 tileindices w12-e12
 * 务必只通过这个方法获取 tileindices
 */
export function getZonesTileIndices(zones: GISZoneMap) {
    if (curTileIndices) return curTileIndices;

    const tileIndices: number[] = [];
    Object.values(zones).forEach((zone) => {
        tileIndices.push(...getZoneTileIndices(zone));
    });

    return tileIndices;
}

/** 判断分区是否是包含关系 */
export function isParentZones(parent: GISZoneMap, child: GISZoneMap) {
    if (!parent || !child) return;

    return Object.keys(child).every((k) => parent[k] != undefined);
}

/**
 * 判断是否是 相同的分区，忽略顺序，对于极点区域，
 * 做一个特殊处理，无论点击极点那块区域都视为点击极区，这里都选择第一块
 */
export function isEqualZones(zones1: GISZoneMap, zones2: GISZoneMap) {
    if (!zones1 || !zones2) return false;

    const polarN1 = zones1[ZONE_KEY_POLAR_N];
    const polarS1 = zones1[ZONE_KEY_POLAR_S];

    if (polarN1) {
        polarN1[1] = 1;
    }

    if (polarS1) {
        polarS1[1] = 1;
    }

    const polarN2 = zones2[ZONE_KEY_POLAR_N];
    const polarS2 = zones2[ZONE_KEY_POLAR_S];

    if (polarN2) {
        polarN2[1] = 1;
    }

    if (polarS2) {
        polarS2[1] = 1;
    }
    // 忽略顺序
    return isEqual(zones1, zones2);
}

/** zones 改变之前 */
function beforeZonesChange() {
    if (!gisZones) return;
}

/** 销毁分区, 主要是图层和边界 */
function removeZones() {
    // if (!gisZones && !force) return;

    if (curTileEdge) {
        curTileEdge.removeFromParent();
        curTileEdge.geometry.dispose();
        // @ts-ignore
        curTileEdge.material.dispose();

        curTileEdge = null;
    }

    // if (curTileLayer && force) {
    //     curTileLayer.removeFromParent();
    //     curTileLayer.geometry.dispose();
    //     // @ts-ignore
    //     curTileLayer.material.dispose();

    //     curTileLayer = null;
    // }

    if (lastCurTileLayer) {
        lastCurTileLayer.removeFromParent();
        lastCurTileLayer.geometry.dispose();
        // @ts-ignore
        lastCurTileLayer.material.dispose();

        lastCurTileLayer = null;
    }
}

function getVisibleZones(zones: GISZoneMap) {
    if (!zones) return;

    const all: GISZoneMap = {};

    for (const zone of Object.values(zones)) {
        if (isVisibleZone(zone)) {
            all[getZoneKey(zone)] = zone;
        }
    }

    let check: GISZoneMap = all;

    while (Object.keys(check).length > 0) {
        const add: GISZoneMap = {};

        for (const zone of Object.values(check)) {
            const adj = getAdjacentZones(zone);

            for (const z of Object.values(adj)) {
                const k = getZoneKey(z);
                if (all[k]) continue;

                // 多包括外面一层，避免pan时的断裂
                if (!isVisibleZone(z)) {
                    all[k] = z;
                    continue;
                }

                all[k] = z;
                add[k] = z;
            }
        }

        check = add;
    }

    return all;
}

/** 获取该分区的相邻分区， 不包括自己 */
function getAdjacentZones(zone: GISZone) {
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
function isAdjacentZones(zone1: GISZone, zone2: GISZone) {
    if (!zone1 || !zone2) return false;

    if (getZoneKey(zone1) === getZoneKey(zone2)) return false;

    // 单独判断极区
    if (isPolarZone(zone1) || isPolarZone(zone2)) {
        //纬度分区差 为 1
        if (Math.abs(zone2[0] - zone1[0]) === 1) return true;
        return false;
    }

    const [zLat1, zLng1] = zone1;
    const [zLat2, zLng2] = zone2;

    if (Math.abs(zLat1 - zLat2) <= 1 && (Math.abs(zLng1 - zLng2) <= 1 || Math.abs(zLng1 - zLng2) === LNG_SLICES - 1)) {
        return true;
    }

    return false;
}

/** 分区是否可见，也即是是否有格子出现在屏幕可见区域内 */
function isVisibleZone(zone: GISZone) {
    const tileIndices = getZoneTileIndices(zone);

    return tileIndices.some((i) => isVisibleTile(i));
}

/** 格子是否在可视区域内 */
export function isVisibleTile(index: number) {
    if (index == undefined) return false;

    const { x, y, z } = meshBytesUtils.getTileByIndex(index);

    return isVisibleVector(new Vector3(x, y, -z));
}

/** 坐标是否可见 */
export function isVisibleVector(v: Vector3) {
    // 注意克隆一下，这个会改变原向量
    const pos = manager.camera.position;

    const dir = v.clone().sub(pos);

    const n = manager.wpToNP(v);
    // 点是否可见需要在屏幕内，在相机视锥体内，面对相机
    return Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1 && Math.abs(n.z) <= 1 && dir.dot(v) < -0.2;
}

/**
 * 获取单个分区内的格子索引，包括极点区域的 所有 tileindices w12-e12
 * 如果该区域处于极地区域，会返回极地区域所有的格子
 */
function getZoneTileIndices(zone: GISZone) {
    if (isPolarZone(zone)) {
        const [lat] = zone;
        const indices: number[] = [];
        for (let i = 1; i <= LNG_SLICES; i++) {
            const _indices = zoneTileIndicesMap.get(getZoneKey([lat, i], true));
            indices.push(..._indices);
        }

        return indices;
    }

    return zoneTileIndicesMap.get(getZoneKey(zone));
}

export function getTileVec(tileInex: number) {
    const { x, y, z } = meshBytesUtils.getTileByIndex(tileInex);
    return new Vector3(x, y, -z);
}

/** 获取分区的包围盒 */
export function getZoneBox(zone: GISZone) {
    let [lat, lng] = zone;

    let top = 0,
        bottom = 0,
        right = 0,
        left = 0;

    if (lat > LAT_SLICES / 2) {
        lat = lat - LAT_SLICES / 2;
        top = LAT_DIVIDER[lat];
        bottom = LAT_DIVIDER[lat - 1];
    } else {
        lat = LAT_SLICES / 2 - lat;
        top = -LAT_DIVIDER[lat];
        bottom = -LAT_DIVIDER[lat + 1];
    }

    if (lng <= LNG_SLICES / 2) {
        right = LNG_DIVIDER * lng;
        left = LNG_DIVIDER * (lng - 1);
    } else {
        lng = LNG_SLICES - lng;
        left = -(lng + 1) * LNG_DIVIDER;
        right = -lng * LNG_DIVIDER;
    }

    return { left, right, top, bottom, center: { lat: (top + bottom) / 2, lng: (left + right) / 2 } };
}

/** 移动相机到该坐标上 */
export async function panToPos(pos: Vector3) {
    if (!pos) return;

    return new Promise((resolve) => {
        const oldPos = manager.camera.position;
        const des = manager.calcCollinearVector(pos, oldPos.length());
        manager.createCameraSphereTween(oldPos, des).onComplete(() => resolve(true));
    });
}

/** 计算向量的正方向，规定为垂直于该向量并指向北极方向, 返回正方向单位向量 */
export function calcVertexPositiveDir(v: Vector3, radius: number) {
    const { x, y, z } = v;

    // 北半球
    if (y > 0) {
        const n = new Vector3(0, 1, 0);
        const angle = n.angleTo(v);
        const length = radius / Math.cos(angle);
        // (0, length, 0) - (x, y, z)
        return new Vector3(-x, length - y, -z).normalize();
    }

    // 赤道
    if (y === 0) {
        return new Vector3(0, 1, 0);
    }

    // 南半球
    if (y < 0) {
        const n = new Vector3(0, -1, 0);
        const angle = n.angleTo(v);
        const length = radius / Math.cos(angle);
        // (x, y, z) - (0, -length, 0)
        return new Vector3(x, y + length, z).normalize();
    }
}

function getTextureUVSpan(textureId: number) {
    if (textureId == null) return;

    const [rows, cols] = TILE_TEXTURE_ATLAS;
    const deltaU = 1 / cols;
    const deltaV = 1 / rows;

    const [u, v] = TILE_TEXTURE_MAP[textureId] || DEFAULT_TERRIAN;
    const leftU = u * deltaU;
    const bottomV = v * deltaV;

    return { leftU, bottomV, deltaU, deltaV };
}

/**
 * 计算顶点 uv 坐标
 * @param bottomLeft uv坐标范围的左下角
 * @param deltaU u 坐标单位跨度
 * @param deltaV v 坐标单位跨度
 * @param vertex 需要计算的顶点坐标
 * @param center 坐标范围中心
 * @param n 正方向, 单位向量
 */
function calcVertexUV(
    bottomLeft: UV,
    deltaU: number,
    deltaV: number,
    vertex: Vector3,
    center: Vector3,
    n: Vector3
): UV {
    const [u, v] = bottomLeft;
    const dir = vertex.clone().sub(center).normalize();
    const angle = dir.angleTo(n);

    // 直接计算的夹角没有方向，这里需要判断夹角方向，使用叉积判断
    // 在threejs右手坐标系下，叉积指向外逆时针方向，反之为顺时针方向
    const { z } = n.clone().cross(dir);

    const halfU = deltaU / 2;
    const halfV = deltaV / 2;

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

export function mixValue(v0: number, v1: number, t: number) {
    return v0 + (v1 - v0) * t;
}
