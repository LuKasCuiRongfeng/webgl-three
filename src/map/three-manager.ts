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
    Float32BufferAttribute,
    PointLight,
    DataTexture,
    RGBAFormat,
    FloatType,
    Frustum,
    Sphere,
} from "three";

// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DragControls } from "three/examples/jsm/controls/DragControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
// import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
// import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";

import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import { Coordinate, Coordinate2D, LatLng } from "./types";
import { Tween, Group as TweenGroup } from "@tweenjs/tween.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import { Lensflare, LensflareElement } from "three/addons/objects/lensflare.js";
import Stats from "three/addons/libs/stats.module.js";

import CustomShaderMaterial from "three-custom-shader-material/vanilla";

import { SphereOrbitControls } from "./sphereOrbit";
import { SimplifyModifier } from "three/addons/modifiers/SimplifyModifier.js";
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
    private _camera: PerspectiveCamera;
    private clock: Clock;
    private cameraOrbitControls: Map<number, SphereOrbitControls> = new Map();

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
    private linearTween: Tween<{ t: number }>;
    private sphereTween: Tween<{ t: number }>;

    private tweenGroup = new TweenGroup();

    private simplifyModifier: SimplifyModifier;

    constructor(parameters?: WebGLRendererParameters) {
        this.renderer = new WebGLRenderer(parameters);
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

    set camera(camera: PerspectiveCamera) {
        if (this._camera == undefined) {
            this._camera = camera;
        }
    }

    get camera() {
        return this._camera;
    }

    getTweenGroup() {
        return this.tweenGroup;
    }

    getRenderer() {
        return this.renderer;
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

    /** 相机动画，只能用于target在原点的相机 */
    createCameraTween(to: Vector3, type: "line" | "sphere", duration = 300, autoStart = true) {
        this.tweenGroup.removeAll();
        const v = this.camera.position.clone();
        const obj = { t: 0 };
        const tween = new Tween(obj).to({ t: 1 }, duration).onUpdate(() => {
            const lerpV = v.clone().lerp(to, obj.t);
            if (type === "line") {
                this.camera.position.copy(lerpV);
            } else {
                this.camera.position.copy(lerpV.normalize().multiplyScalar(v.length()));
            }
            this.getOrbitControls(this.camera).update()
        });

        if (autoStart) {
            tween.start();
        }

        this.tweenGroup.add(tween);

        return tween;
    }

    /** 球面相机动画，只能用于target在原地的动画 */
    createSphereTween(to: Vector3, duration = 300, autoStart = true) {
        this.tweenGroup.removeAll();
        const obj = { t: 0 };
        const start = this.camera.position.clone().normalize();
        const end = to.clone().normalize();
        const oldQuat = this.camera.quaternion.clone();

        const quat = new Quaternion();
        const quat1 = new Quaternion().setFromUnitVectors(start, end);

        const tween = new Tween(obj).to({ t: 1 }, duration).onUpdate(() => {
            this.camera.quaternion.copy(oldQuat);
            this.camera.applyQuaternion(quat.clone().slerp(quat1, obj.t));
        });

        if (autoStart) {
            tween.start();
        }

        this.tweenGroup.add(tween);

        return tween;
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

    /** 获取该相机绑定的 orbitControls，如果没有则创建 */
    getOrbitControls(camera: Camera, domElement?: HTMLElement) {
        let controls = this.cameraOrbitControls.get(camera.id);
        if (controls == undefined) {
            // @ts-ignore
            controls = new SphereOrbitControls(camera, domElement);
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

    getGLTFLoader(manager?: LoadingManager) {
        if (this.glTFLoader == undefined) {
            this.glTFLoader = new GLTFLoader(manager);
        } else {
            this.glTFLoader.manager = manager;
        }
        return this.glTFLoader;
    }

    getFBXLoader(manager?: LoadingManager) {
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
            this.outlinePass = new OutlinePass(
                new Vector2(canvas.width, canvas.height),
                this.scene,
                this.camera
            );

            this.getComposer().addPass(this.outlinePass);
        }
        return this.outlinePass;
    }

    getComposer() {
        if (this.composer == undefined) {
            // const canvas = this.renderer.domElement;
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

    /** 鼠标拾取目标 */
    rayPicker(objs: Object3D[], ndc: Coordinate2D, recursive?: boolean) {
        if (!this.rayCaster) {
            this.rayCaster = new Raycaster();
            // 性能考虑
            this.rayCaster.firstHitOnly = true;
        }

        // 增加鼠标中心缩放
        this.rayCaster.setFromCamera(new Vector2(ndc.x, ndc.y), this.camera);
        const interObjs = this.rayCaster.intersectObjects(objs, recursive);

        if (interObjs.length > 0) {
            return interObjs[0];
        }
    }

    /** 获取从相机到点的射线 */
    getCameraCastRay(ndc: Coordinate2D) {
        if (!this.rayCaster) {
            this.rayCaster = new Raycaster();
            this.rayCaster.firstHitOnly = true;
        }
        // 增加鼠标中心缩放
        this.rayCaster.setFromCamera(new Vector2(ndc.x, ndc.y), this.camera);
        return this.rayCaster.ray;
    }

    /**
     * 计算射线和位于原点的半径为radius的球体的交点
     * 只考虑射线原点在球体外的情况，射线原点在球体内部
     * 必相交，不考虑
     * 参考 [射线相交数学计算](https://zhuanlan.zhihu.com/p/136763389)
     */
    getIntersectOfRay(radius: number, ndc: Coordinate2D) {
        const ray = this.getCameraCastRay(ndc);
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
    getCanvasScreenSpace(e: PointerEvent) {
        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();

        return {
            x: ((e.clientX - rect.left) * canvas.width) / rect.width,
            y: ((e.clientY - rect.top) * canvas.height) / rect.height,
        };
    }

    /** 获取标准设备坐标 */
    getCanvasNDC(event: PointerEvent) {
        const ss = this.getCanvasScreenSpace(event);
        return this.screenSpaceToNDC(ss);
    }

    /** 屏幕坐标转标准设备坐标 */
    screenSpaceToNDC(ss: Coordinate2D) {
        const { x, y } = ss;
        const canvas = this.renderer.domElement;

        return {
            x: (x / canvas.width) * 2 - 1,
            y: (y / canvas.height) * -2 + 1,
        };
    }

    /** 标准设备坐标转世界坐标 */
    ndcToWorldSpace(ndc: Coordinate2D) {
        // 0.5 是业界比较通用的 2d转3d的深度值
        const v3 = new Vector3(ndc.x, ndc.y, 0.5);
        return v3.unproject(this.camera);
    }

    /** 世界坐标转标准设备坐标 */
    worldSpaceToNDC(v: Vector3) {
        // 得到设备坐标系，先克隆，投影会改变原向量
        const { x, y, z } = v.clone().project(this.camera);
        return { x, y, z };
    }

    /** 设备坐标转屏幕坐标 */
    ndcToScreenSpace(v: Coordinate2D | Coordinate) {
        const canvas = this.renderer.domElement;
        return {
            x: ((v.x + 1) / 2) * canvas.width,
            y: ((v.y - 1) / -2) * canvas.height,
        };
    }

    /** 返回与 dir 同方向的长度为length的向量 */
    getCollinearVector(dir: Vector3, length: number) {
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

    /**
     * 精简三角面，可以选中配合 LOD 优化体验
     * @param geometry 需要被精简的geometry
     * @param ratio 精简比例，范围 0 ~ 1，值越大越精简
     */
    simplifyMesh(geometry: BufferGeometry, ratio = 0.5) {
        if (!this.simplifyModifier) {
            this.simplifyModifier = new SimplifyModifier();
        }

        const count = geometry.getAttribute("position")?.count;
        if (!count) throw new Error("无法识别顶点");

        const removeCount = Math.floor(count * ratio);

        // 很操蛋的是 modify第二个参数count 代表的是需要被删除的顶点数量，必须取整
        // 实现过程是简单无脑的遍历，如果geometry顶点数量巨大，会造成严重的卡顿
        return this.simplifyModifier.modify(geometry, removeCount);
    }

    /**
     * instancedMesh的视锥实例剔除
     * @param mesh instancedMesh
     * @param instancedCount 最大数量
     * @param frustum 视锥
     * @param radius 预估实例包围球半径
     */
    frustumCulledInstance(
        mesh: InstancedMesh,
        instancedCount: number,
        frustum: Frustum,
        radius = 1
    ) {
        const mat4Map: Map<number, Matrix4> = new Map();
        // 包围球
        const sphere = new Sphere();
        sphere.radius = radius;

        for (let i = 0; i < instancedCount; i++) {
            const mat4 = new Matrix4();
            mesh.getMatrixAt(i, mat4);

            const pos = new Vector3();
            const quat = new Quaternion();
            const scale = new Vector3();
            mat4.decompose(pos, quat, scale);

            sphere.center.copy(pos);

            if (frustum.intersectsSphere(sphere)) {
                mat4Map.set(i, mat4);
            }
        }

        // 为了简单，全部交换矩阵
        let i = 0;
        const size = mat4Map.size;
        for (const [id, mat4] of mat4Map) {
            const head = new Matrix4();
            mesh.getMatrixAt(i, head);
            mesh.setMatrixAt(i, mat4);
            mesh.setMatrixAt(id, head);

            i++;
        }

        // 修改渲染数量，只渲染视锥内的实例
        mesh.count = size;

        mesh.instanceMatrix.needsUpdate = true;
    }

    /** 获取相机视锥体 */
    getCameraFrustum() {
        const camera = this.camera;
        const frustum = new Frustum();
        frustum.setFromProjectionMatrix(
            new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        );

        return frustum;
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
    Float32BufferAttribute,
    SphereOrbitControls,
    Lensflare,
    LensflareElement,
    PointLight,
    DataTexture,
    RGBAFormat,
    FloatType,
    Frustum,
    Sphere,
    SimplifyModifier,
    Tween,
};
