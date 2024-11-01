/**
 * @description 生成地图核心类，每个类的实例生成一个操作地图核心api
 */
// ----------------------------------------------------
// ----------------------------------------------------
// ----------------------------------------------------
// ----------------------------------------------------
// ----------------------------------------------------
// ----------------------------------------------------
import {
    AxesHelper,
    Camera,
    Clock,
    DirectionalLight,
    DirectionalLightHelper,
    Material,
    Object3D,
    PerspectiveCamera,
    Scene,
    TextureLoader,
    WebGLRenderer,
    AmbientLight,
    Mesh,
    MeshPhongMaterial,
    SphereGeometry,
    WebGLRendererParameters,
    Shape,
    ShapeGeometry,
    MeshBasicMaterial,
    Group,
    BufferGeometry,
    Vector3,
    MathUtils,
    DoubleSide,
    FrontSide,
    BackSide,
    Line,
    LineBasicMaterial,
    Raycaster,
    BufferAttribute,
    LineLoop,
    EdgesGeometry,
    LineSegments,
    WebGLCubeRenderTarget,
    ArrowHelper,
    CatmullRomCurve3,
    Points,
    PointsMaterial,
    MOUSE,
    Quaternion,
    Spherical,
    Texture,
    Sprite,
    SpriteMaterial,
    ShaderMaterial,
    Color,
    CanvasTexture,
    LinearFilter,
    RingGeometry,
    TubeGeometry,
    Vector2,
    SRGBColorSpace,
    HemisphereLight,
    PlaneGeometry,
    AnimationMixer,
    AnimationAction,
    GridHelper,
    Fog,
    Box3,
    BoxHelper,
    LoadingManager,
    Data3DTexture,
    RedFormat,
    RawShaderMaterial,
    GLSL3,
    BoxGeometry,
    RepeatWrapping,
    LineDashedMaterial,
    MeshLambertMaterial,
    MeshStandardMaterial,
    MeshPhysicalMaterial,
    InstancedBufferGeometry,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    Uniform,
    Float32BufferAttribute
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DragControls } from "three/examples/jsm/controls/DragControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import { Coordinate, Coordinate2D, LatLng } from "./types";
import TWEEN, { Tween } from "@tweenjs/tween.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import Stats from "three/addons/libs/stats.module.js"

import CustomShaderMaterial from "three-custom-shader-material/vanilla"
// ----------------------------------------------------
// ----------------------------------------------------
// ----------------------------------------------------
// ----------------------------------------------------
// ----------------------------------------------------
// ----------------------------------------------------
Mesh.prototype.raycast = acceleratedRaycast;

class ThreeManager {
    private renderer: WebGLRenderer;
    private _scene: Scene;

    /** 只保留一个主视角相机 */
    private _camera: Camera;
    private clock: Clock;
    private cameraOrbitControls: Map<number, OrbitControls> = new Map();

    private cameraDragControls: Map<number, DragControls> = new Map();

    private transformControl: Map<number, TransformControls> = new Map();

    private glTFLoader: GLTFLoader;
    private fbxLoader: FBXLoader;
    private textureLoader: TextureLoader;
    private rayCaster: Raycaster;
    private outlinePass: OutlinePass;
    private composer: EffectComposer;

    /**
     * cameraTween，考虑到频繁创建tween可能对性能
     * 有影响，cameraTween每次创建覆盖前一个
     * 注意tween没办法复用，设置了tween的起点就会
     * 一直从这个起点开始动画，导致跳动，所以每次
     * 都需要从新创建tween
     */
    private cameraTween: Tween<Vector3>;

    constructor(parameters?: WebGLRendererParameters) {
        this.renderer = new WebGLRenderer(parameters);
        // this.renderer.useLegacyLights = true;
    }

    /** 设置或得到场景 */
    set scene(scene: Scene) {
        if (this._scene == undefined) {
            this._scene = scene;
        }
    }

    get scene() {
        return this._scene;
    }

    /** 设置或得到主视角相机，相机可能会有很多个，这里只包括主视角相机 */
    set camera(camera: Camera) {
        if (this._camera == undefined) {
            this._camera = camera;
        }
    }

    get camera() {
        return this._camera;
    }

    /**
     * 创建相机的位置动画
     * 这个动画很干脆，直接走直线，很多时候达不到效果
     * 比如想沿着曲线走
     * @param duration 持续视角
     * @param autoStart 动画自动执行，默认true
     */
    createCameraTween(start: Vector3, end: Vector3, duration = 300, autoStart = true) {
        // tween必须重新创建
        this.cameraTween = new Tween(start);
        this.cameraTween.to(end, duration);

        if (autoStart) {
            this.cameraTween.start();
        }

        return this.cameraTween;
    }

    /**
     * 创建基于球面相机的补间动画，相机不会再直线穿过从 A 到 B
     * 而是绕着球面走最短路线 从 A 到 B
     * @param duration 持续视角 default 300
     * @param autoStart 动画自动执行，默认true
     */
    createCameraSphereTween(start: Vector3, end: Vector3, duration = 300, autoStart = true) {
        // tween必须重新创建
        // 用角度代替相机位置，实现球面运动，牛逼
        // 这里必须克隆一下，动画过程中会不断更改相机位置，更改start，导致计算粗错
        const _s = start.clone();
        const angle = { value: 0 };
        const tween = new Tween(angle);
        const angleEnd = start.angleTo(end);
        const n = start.clone().cross(end).normalize();
        tween.to({ value: angleEnd }, duration).onUpdate(({ value }) => {
            // 直接修改相机位置
            // 必须用克隆版本，否则 夹角不对
            this.camera.position.copy(_s).applyAxisAngle(n, value);
        });

        if (autoStart) {
            tween.start();
        }

        return tween;
    }

    /**
     * 创建基于四元数球面相机的补间动画，相机不会再直线穿过从 A 到 B
     * 而是绕着球面走最短路线 从 A 到 B
     * @param duration 持续视角
     * @param autoStart 动画自动执行，默认true
     */
    createCameraSphereQuaternionTween(start: Vector3, end: Vector3, duration = 300, autoStart = true) {
        // tween必须重新创建
        const q1 = this.camera.quaternion;
        const q2 = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), end.clone().normalize());
        const tween = new Tween(q1);
        tween.to(q2, duration);

        if (autoStart) {
            tween.start();
        }

        return tween;
    }

    getRenderer() {
        return this.renderer;
    }

    /**
     * 调整 canvas 内部尺寸匹配视口尺寸，同时会更新相机的 aspect，避免画面变形，
     * 在自适应窗口下为了保持画布不变形，需要在 animte loop 动画里一直调用这个方法
     */
    resizeRendererToDisplaySize() {
        const canvas = this.renderer.domElement;
        const pixelRatio = window.devicePixelRatio;
        const width = canvas.clientWidth * pixelRatio;
        const height = canvas.clientHeight * pixelRatio;
        const needResize = canvas.width !== width || canvas.height !== height;

        if (needResize) {
            this.renderer.setSize(width, height, false);
            // 对于透视相机，需要更正 宽高比
            if (this.camera instanceof PerspectiveCamera) {
                this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
                // 当动态改变摄像机参数的时候，必须主动调用一下来更新参数
                this.camera.updateProjectionMatrix();
            }
        }
        return needResize;
    }

    /**
     * 循环动画， 传入 null 停止动画，如果不需要动画，比如只是一些
     * 静态的画面直接调用 `this.getRenderer().render()` 获得更好的性能
     */
    loop(callback?: (time: number) => void) {
        this.getRenderer().setAnimationLoop(callback);
    }

    getClock() {
        if (this.clock == undefined) {
            this.clock = new Clock();
        }
        return this.clock;
    }

    /** 获取该相机绑定的 orbitControls，如果没有则创建 */
    getOrbitControls(camera: Camera, domElement?: HTMLElement) {
        let controls = this.cameraOrbitControls.get(camera.id);
        if (controls == undefined) {
            controls = new OrbitControls(camera, domElement);
            // controls.zoomToCursor = true;
            this.cameraOrbitControls.set(camera.id, controls);
        }
        return controls;
    }

    /**
     * 获取拖拽控件，没有就创建，注意为了保证复用，控制的对象长度
     * 默认给与 0, 拿到controls后需手动 push 控制的Object3D
     */
    getDragControls(camera: Camera, domElement?: HTMLElement) {
        let control = this.cameraDragControls.get(camera.id);
        if (control == undefined) {
            control = new DragControls([], camera, domElement);
            this.cameraDragControls.set(camera.id, control);
        }

        return control;
    }

    getTransformControl(camera: Camera, domElement?: HTMLElement) {
        let control = this.transformControl.get(camera.id);
        if (control == undefined) {
            control = new TransformControls(camera, domElement);
            this.transformControl.set(camera.id, control);
        }

        return control;
    }

    GetGLTFLoader(manager?: LoadingManager) {
        if (this.glTFLoader == undefined) {
            this.glTFLoader = new GLTFLoader(manager);
        } else {
            this.glTFLoader.manager = manager;
        }
        return this.glTFLoader;
    }

    GetFBXLoader(manager?: LoadingManager) {
        if (this.fbxLoader == undefined) {
            this.fbxLoader = new FBXLoader(manager);
        } else {
            this.fbxLoader.manager = manager;
        }
        return this.fbxLoader;
    }

    getTextureLoader() {
        if (this.textureLoader == undefined) {
            this.textureLoader = new TextureLoader();
        }
        return this.textureLoader;
    }

    getOutlinePass() {
        if (this.outlinePass == undefined) {
            const canvas = this.renderer.domElement;
            this.outlinePass = new OutlinePass(new Vector2(canvas.width, canvas.height), this.scene, this.camera);

            this.getComposer().addPass(this.outlinePass);
        }
        return this.outlinePass;
    }

    getComposer() {
        if (this.composer == undefined) {
            const canvas = this.renderer.domElement;
            this.composer = new EffectComposer(this.renderer);

            const renderPass = new RenderPass(this.scene, this.camera);
            this.composer.addPass(renderPass);

            const outputPass = new OutputPass();
            this.composer.addPass(outputPass);

            // const fxaa = new ShaderPass(FXAAShader);
            // fxaa.uniforms["resolution"].value.set(1 / canvas.width, 1 / canvas.height)
            // this.composer.addPass(fxaa)
        }
        return this.composer;
    }

    /** 部分渲染画布，计算该元素和画布的重叠面积， 返回重叠部分的宽高比 */
    setScissorForElement(canvas: HTMLCanvasElement, elem: HTMLElement) {
        const canvasRect = canvas.getBoundingClientRect();
        const elemRect = elem.getBoundingClientRect();

        const right = Math.min(elemRect.right, canvasRect.right) - canvasRect.left;
        const left = Math.max(0, elemRect.left - canvasRect.left);
        const bottom = Math.min(elemRect.bottom, canvasRect.bottom) - canvasRect.top;
        const top = Math.max(0, elemRect.top - canvasRect.top);

        const width = Math.min(canvasRect.width, right - left);
        const height = Math.min(canvasRect.height, bottom - top);

        const positiveYUpBottom = canvasRect.height - bottom;

        this.getRenderer().setScissor(left, positiveYUpBottom, width, height);
        this.getRenderer().setViewport(left, positiveYUpBottom, width, height);

        return width / height;
    }

    /** 平行光 helper，帮助观察 */
    directionalLightHelper(light: DirectionalLight, node: Object3D) {
        let helper = node.getObjectByName(`lighthelper${light.uuid}`) as DirectionalLightHelper;
        if (helper == undefined) {
            helper = new DirectionalLightHelper(light);
            helper.name = `lighthelper${light.uuid}`;
            node.add(helper);
        }
        return helper;
    }

    /** 鼠标拾取目标 */
    picker(objs: Object3D[], np: Coordinate2D, recursive?: boolean) {
        if (!this.rayCaster) {
            this.rayCaster = new Raycaster();
            this.rayCaster.firstHitOnly = true;
        }

        // 增加鼠标中心缩放
        this.rayCaster.setFromCamera(new Vector2(np.x, np.y), this.camera);

        const _objs = this.rayCaster.intersectObjects(objs, recursive);

        if (_objs.length > 0) {
            return _objs[0];
        }
        return null;
    }

    /** 获取射线 */
    getCastRay(np: Coordinate2D) {
        if (!this.rayCaster) {
            this.rayCaster = new Raycaster();
            this.rayCaster.firstHitOnly = true;
        }
        // 增加鼠标中心缩放
        this.rayCaster.setFromCamera(new Vector2(np.x, np.y), this.camera);
        return this.rayCaster.ray;
    }

    /**
     * 计算射线和位于原点的半径为radius的球体的交点
     * 只考虑射线原点在球体外的情况，射线原点在球体内部
     * 必相交，不考虑
     * 参考 [射线相交数学计算](https://zhuanlan.zhihu.com/p/136763389)
     */
    getIntersectOfRay(radius: number, np: Coordinate2D) {
        const ray = this.getCastRay(np);
        if (!ray) return;
        const { origin, direction } = ray;
        // (0, 0, 0) - origin
        // 球心在原点，直接反向，指向球心
        const vectorA = origin.clone().multiplyScalar(-1);
        const lengthA = vectorA.length();
        // 计算a向量在射线方向上的投影长度
        const scalarL = vectorA.dot(direction);
        // 交点在orgin后面，必定不相交
        if (lengthA > radius && scalarL < 0) return;
        const r2 = radius ** 2;
        const a2 = lengthA ** 2;
        // 这种情况射线原点位于球面上或求内部，必定相交，不考虑
        if (a2 <= r2) return;
        const l2 = scalarL ** 2;
        // 计算球心到射线方向的垂直距离
        const m2 = a2 - l2;
        // 距离大于球半径，必不相交
        if (m2 > r2) return;
        const q = Math.sqrt(r2 - m2);
        // 方向向量长度 l - q
        const vectorL = direction.clone().multiplyScalar(scalarL - q);
        return vectorL.sub(vectorA);
    }

    /** 获取屏幕坐标 */
    getCanvasRP(event: PointerEvent | MouseEvent) {
        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) * canvas.width) / rect.width,
            y: ((event.clientY - rect.top) * canvas.height) / rect.height,
        };
    }

    /** 获取设备坐标 */
    getCanvasNP(event: PointerEvent | MouseEvent) {
        const rp = this.getCanvasRP(event);

        return this.rpToNP(rp);
    }

    /** 屏幕坐标转设备坐标 */
    rpToNP(rp: Coordinate2D) {
        const { x, y } = rp;
        const canvas = this.renderer.domElement;

        return {
            x: (x / canvas.width) * 2 - 1,
            y: (y / canvas.height) * -2 + 1,
        };
    }

    /** 标准设备坐标转世界坐标 */
    npToWP(np: Coordinate2D) {
        // 0.5 是业界比较通用的 2d转3d的深度值
        const v3 = new Vector3(np.x, np.y, 0.5);

        return v3.unproject(this.camera);
    }

    /** 世界坐标转标准设备坐标 */
    wpToNP(v: Vector3) {
        // 得到设备坐标系，先克隆，投影会改变原向量
        const { x, y, z } = v.clone().project(this.camera);

        return { x, y, z };
    }

    /** 设备坐标转屏幕坐标 */
    npToRP(v: Coordinate2D | Coordinate) {
        const canvas = this.renderer.domElement;

        return {
            x: ((v.x + 1) / 2) * canvas.width,
            y: ((v.y - 1) / -2) * canvas.height,
        };
    }

    /** 返回与 dir 同方向的长度为length的向量 */
    calcCollinearVector(dir: Vector3, length: number) {
        return dir.clone().normalize().multiplyScalar(length);
    }

    // /** 经纬度转向量坐标 */
    // latLngToVector3(lat: number, lng: number, radius = 1) {
    //     const latRad = (lat * Math.PI) / 180;
    //     const lngRad = (lng * Math.PI) / 180;

    //     const x = radius * Math.cos(latRad) * Math.sin(lngRad);
    //     const y = radius * Math.sin(latRad);
    //     const z = radius * Math.cos(latRad) * Math.cos(lngRad);

    //     return new Vector3(x, y, z);
    // }

    /** 经纬度转向量坐标 unity version */
    latLngToVector3(lat: number, lng: number, radius = 1) {
        const latRad = (lat * Math.PI) / 180;
        const lngRad = (lng * Math.PI) / 180;

        const x = radius * Math.cos(latRad) * Math.cos(lngRad);
        const y = radius * Math.sin(latRad);
        const z = -radius * Math.cos(latRad) * Math.sin(lngRad);

        return new Vector3(x, y, z);
    }

    /** 向量坐标转经纬度 */
    // vector3ToLatLng(v: Vector3): LatLng {
    //     const normize = v.clone().normalize();
    //     const { x, y, z } = normize;
    //     const lat = Math.asin(y);

    //     let lng = 0;
    //     if (z === 0) {
    //         if (x > 0) {
    //             lng = Math.PI / 2;
    //         } else {
    //             lng = -Math.PI / 2;
    //         }
    //     } else {
    //         // atan  pi / 2 ~ -pi / 2
    //         lng = Math.atan2(x, Math.abs(z));
    //         if (z < 0) {
    //             // 反转
    //             if (lng > 0) {
    //                 lng = Math.PI - lng;
    //             }
    //             if (lng < 0) {
    //                 lng = -(Math.PI - Math.abs(lng));
    //             }
    //         }
    //     }

    //     return {
    //         lat: (lat / Math.PI) * 180,
    //         lng: (lng / Math.PI) * 180,
    //     };
    // }

    /** 向量坐标转经纬度 unity version */
    vector3ToLatLng(v: Vector3): LatLng {
        const normize = v.clone().normalize();
        const { x, y, z } = normize;
        const lat = Math.asin(y);

        let lng = 0;
        if (x === 0) {
            if (z < 0) {
                lng = Math.PI / 2;
            } else {
                lng = -Math.PI / 2;
            }
        } else {
            // atan  pi / 2 ~ -pi / 2
            lng = -Math.atan2(z, Math.abs(x));
            if (x < 0) {
                // 反转
                if (lng > 0) {
                    lng = Math.PI - lng;
                }
                if (lng < 0) {
                    lng = -(Math.PI - Math.abs(lng));
                }
            }
        }

        return {
            lat: (lat / Math.PI) * 180,
            lng: (lng / Math.PI) * 180,
        };
    }
}

export default ThreeManager;

export {
    AxesHelper,
    Camera,
    Clock,
    DirectionalLight,
    DirectionalLightHelper,
    Material,
    Object3D,
    PerspectiveCamera,
    Scene,
    TextureLoader,
    WebGLRenderer,
    AmbientLight,
    Mesh,
    MeshPhongMaterial,
    SphereGeometry,
    type WebGLRendererParameters,
    Shape,
    ShapeGeometry,
    MeshBasicMaterial,
    Group,
    BufferGeometry,
    Vector3,
    MathUtils,
    DoubleSide,
    FrontSide,
    BackSide,
    Line,
    LineBasicMaterial,
    Raycaster,
    BufferAttribute,
    BufferGeometryUtils,
    LineLoop,
    EdgesGeometry,
    MeshBVH,
    LineSegments,
    WebGLCubeRenderTarget,
    TWEEN,
    ArrowHelper,
    Line2,
    LineGeometry,
    LineMaterial,
    CatmullRomCurve3,
    Points,
    PointsMaterial,
    MOUSE,
    Texture,
    Sprite,
    SpriteMaterial,
    DragControls,
    ShaderMaterial,
    Color,
    Spherical,
    CanvasTexture,
    LinearFilter,
    RingGeometry,
    TubeGeometry,
    Vector2,
    SRGBColorSpace,
    HemisphereLight,
    PlaneGeometry,
    AnimationMixer,
    AnimationAction,
    GridHelper,
    Fog,
    Box3,
    BoxHelper,
    LoadingManager,
    ImprovedNoise,
    Data3DTexture,
    RedFormat,
    RawShaderMaterial,
    GLSL3,
    BoxGeometry,
    RepeatWrapping,
    LineDashedMaterial,
    MeshLambertMaterial,
    MeshStandardMaterial,
    MeshPhysicalMaterial,
    CustomShaderMaterial,
    InstancedBufferGeometry,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    Quaternion,
    Stats,
    Uniform,
    Float32BufferAttribute
};
