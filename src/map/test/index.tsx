import { useEffect, useRef } from "react";
import {
    AmbientLight,
    AxesHelper,
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    ConeGeometry,
    DirectionalLight,
    DoubleSide,
    DynamicDrawUsage,
    EdgesGeometry,
    Float32BufferAttribute,
    FrontSide,
    Frustum,
    IcosahedronGeometry,
    InstancedBufferGeometry,
    InstancedMesh,
    LineBasicMaterial,
    LineSegments,
    LOD,
    Matrix4,
    Mesh,
    MeshPhongMaterial,
    MeshPhysicalMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    Quaternion,
    Raycaster,
    Scene,
    ShaderMaterial,
    Sphere,
    SphereGeometry,
    Spherical,
    Vector2,
    Vector3,
    WebGLRenderer,
} from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { OrbitControls, MapControls, GLTFLoader } from "three/examples/jsm/Addons.js";

import vert from "./vert.glsl";
import frag from "./frag.glsl";
import { MeshPhongNodeMaterial } from "three/webgpu";

import { SphereOrbitControlsBack } from "../orbit";
import { MeshBVH } from "three-mesh-bvh";
import Stats from "three/addons/libs/stats.module.js";

import { SimplifyModifier } from "three/addons/modifiers/SimplifyModifier.js";

const min_dis = 30;

let low_height = false;

const rayCaster = new Raycaster();

let camera: PerspectiveCamera = null;

let scene: Scene = null;

let plane: Mesh = null;

export default function Test() {
    const canvasRef = useRef<HTMLCanvasElement>();

    useEffect(() => {
        const canvas = canvasRef.current;
        run();
    }, []);

    const run = async () => {
        const stats = new Stats();
        const canvas = canvasRef.current;
        canvas.parentElement.appendChild(stats.dom);
        const renderer = new WebGLRenderer({ antialias: true, canvas });
        scene = new Scene();

        camera = new PerspectiveCamera(75, 1.5, 0.1, 50000);
        camera.position.set(0, 0, 50);
        const controls = new SphereOrbitControlsBack(camera, canvas);
        controls.enableDamping = false;
        controls.screenSpacePanning = true;

        const light = new DirectionalLight(0xffffff, 1);
        light.position.set(20, 20, 20);
        const ambient = new AmbientLight(0xffffff, 1);
        scene.add(light, ambient);

        const axis = new AxesHelper(15);
        scene.add(axis);

        const loader = new GLTFLoader();

        const simp = new SimplifyModifier();

        const gltf = await loader.loadAsync("http://localhost:12345/fuck/quiver_tree_02_1k.gltf");

        const tree = gltf.scene;

        const mesh = tree.children[0] as Mesh;
        mesh.position.set(2, 2, 2);
        mesh.add(axis.clone());
        mesh.scale.set(10, 10, 10);
        const geo = mesh.geometry;
        const mat = mesh.material;

        const v1 = new Vector3(1, 0, 0);
        const v2 = new Vector3(1, 0.01, 0).normalize();
        const quat1 = new Quaternion().setFromUnitVectors(v1, v2);

        const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 1);

        scene.add(mesh);

        renderer.setAnimationLoop(() => {
            renderer.render(scene, camera);
            mesh.applyQuaternion(quat1);
            stats.update();
        });
    };

    return <canvas width={900} height={600} ref={canvasRef}></canvas>;
}
