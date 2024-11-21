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

        // canvas.addEventListener("pointerdown", (e) => {
        //     canvas.setPointerCapture(e.pointerId)
        //     console.log(e.pointerId, e.pointerType);
        // });
        canvas.addEventListener("pointermove", (event) => {});
        // canvas.addEventListener("pointerup", (e) => {
        //     console.log(e.pointerId, e.pointerType);
        // });
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
        controls.screenSpacePanning = false;
        // controls.maxPolarAngle = Math.PI / 2;
        // controls.enablePan = false;

        const light = new DirectionalLight(0xffffff, 1);
        light.position.set(20, 20, 20);
        const ambient = new AmbientLight(0xffffff, 1);
        scene.add(light, ambient);

        const axis = new AxesHelper(15);
        scene.add(axis);

        {
            const count = 2;
            const geo = new InstancedBufferGeometry();
            geo.instanceCount = count;
            const positions: number[] = [];
            positions.push(10, 0, 0, 0, 10, 0, 0, 0, 10);
            geo.setAttribute("position", new Float32BufferAttribute(positions, 3));

            const mat = new ShaderMaterial({
                side: DoubleSide,
                vertexShader: /* glsl*/ `
                    varying float vID;
                    void main() {
                        vec3 pos  = position;
                        pos.y += sin(pos.x);
                        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(pos, 1.0);

                        vID = float(gl_InstanceID);
                    }
                `,
                fragmentShader: /*glsl */ `
                    varying float vID;
                    void main() {
                        vec3 color = mix(vec3(1.), vec3(1.0, 0., 0.), vID);
                        gl_FragColor = vec4(color, 1.);
                    }
                `,
            });

            const mesh = new InstancedMesh(geo, mat, count);
            // scene.add(mesh);
            mesh.instanceMatrix.setUsage(DynamicDrawUsage);

            for (let i = 0; i < count; i++) {
                const matrix = new Matrix4();
                const position = new Vector3(10 * Math.random(), 10 * Math.random(), 10 * Math.random());
                const quat = new Quaternion().random();
                const scale = new Vector3(1, 1, 1);
                matrix.compose(position, quat, scale);
                mesh.setMatrixAt(i, matrix);
            }

            setTimeout(() => {
                const matrix = new Matrix4();
                const position = new Vector3(10 * Math.random(), 10 * Math.random(), 10 * Math.random());
                const quat = new Quaternion().random();
                const scale = new Vector3(1, 1, 1);
                matrix.compose(position, quat, scale);

                mesh.setMatrixAt(1, matrix);
                mesh.instanceMatrix.needsUpdate = true;
            }, 2000);
        }

        const loader = new GLTFLoader();

        const simp = new SimplifyModifier();

        const gltf = await loader.loadAsync("http://localhost:12345/fuck/quiver_tree_02_1k.gltf");

        const tree = gltf.scene;

        const mesh = tree.children[0] as Mesh;
        mesh.scale.set(100, 100, 100);
        const geo = mesh.geometry;
        const mat = mesh.material;
        // mat.wireframe = true
        // const lod = new LOD()

        // const vertCount = geo.getAttribute("position").count;

        // // 我真的会操雪，这个第二个参数 count需要int，是需要删掉的顶点，不是保留的顶点
        // const medium = simp.modify(geo, Math.floor(vertCount * 0.9))
        // const mediumCount = medium.getAttribute("position").count
        // const low = simp.modify(medium, Math.floor(mediumCount * 0.9))

        // const lowMesh = new Mesh(low, mat)
        // const mediumMesh = new Mesh(medium, mat)
        // lowMesh.scale.set(100, 100, 100);
        // mediumMesh.scale.set(100, 100, 100);

        // lod.addLevel(mesh, 30)
        // lod.addLevel(mediumMesh, 100)
        // lod.addLevel(lowMesh, 200)

        // scene.add(lod)

        const count = 50000;

        const inMesh = new InstancedMesh(geo, mat, count);
        const sphere = new Mesh(
            new SphereGeometry(10, 10, 10),
            new MeshPhongMaterial({ color: 0x00ff00, wireframe: true })
        );

        scene.add(sphere);
        scene.add(inMesh);

        inMesh.instanceMatrix.setUsage(DynamicDrawUsage);

        // 对于其他的mesh，会自动做视锥剔除，但是
        // 我操穴，instancedMesh无法做单个实例的视锥剔除
        // 如果这些instance有一个在视锥内，就会渲染全部实例
        // 导致性能降低
        // inMesh.frustumCulled = false

        const matrix = new Matrix4();
        const yp = new Vector3(0, 1, 0);
        const sph = new Spherical(10, 0, 0);
        for (let i = 0; i < count; i++) {
            // sph.theta = Math.random() * Math.PI * 2;
            // sph.phi = Math.random() * Math.PI
            const pos = new Vector3().setFromSpherical(sph);
            const quat = new Quaternion().setFromUnitVectors(yp, pos.clone().normalize());
            matrix.compose(new Vector3(100000, 0, 0), quat, new Vector3(3, 3, 3));

            inMesh.setMatrixAt(i, matrix);
        }

        setTimeout(() => {
            sph.theta = Math.PI;
            sph.phi = Math.PI / 2;
            const pos = new Vector3().setFromSpherical(sph);
            const quat = new Quaternion().setFromUnitVectors(yp, pos.clone().normalize());
            matrix.compose(pos, quat, new Vector3(3, 3, 3));
            // matrix.setPosition(pos)

            inMesh.setMatrixAt(11, matrix);

            inMesh.instanceMatrix.needsUpdate = true;
            inMesh.computeBoundingSphere();
        }, 2000);

        // 每次只渲染视锥内部的实例，实际上是和头部
        // 的实例交互矩阵，可能还会交互其他属性，比如颜色
        const frustum = new Frustum();
        frustum.setFromProjectionMatrix(
            new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        );

        function frustumCulledInstance() {
            const matrix: Map<number, Matrix4> = new Map();
            const sphere = new Sphere();
            // 预估半径，可能不准
            sphere.radius = 2

            for (let i = 0; i < count; i++) {
                const mat4 = new Matrix4();
                inMesh.getMatrixAt(i, mat4);
                const pos = new Vector3();
                const quat = new Quaternion();
                const scale = new Vector3();
                mat4.decompose(pos, quat, scale);

                sphere.center.copy(pos);
                if (frustum.intersectsSphere(sphere)) {
                    matrix.set(i, mat4);
                }
            }

            // 为了简单，全部交换
            let i = 0;
            const size = matrix.size
            for (const [id, mat4] of matrix) {
                const head = new Matrix4();
                inMesh.getMatrixAt(i, head);

                inMesh.setMatrixAt(i, mat4);
                inMesh.setMatrixAt(id, head);
                i++;
            }

            inMesh.count = size;

            inMesh.instanceMatrix.needsUpdate = true;
        }

        renderer.setAnimationLoop(() => {
            renderer.render(scene, camera);
            // controls.update();
            // mesh.rotation.y += 0.1
            stats.update();
            frustumCulledInstance();
        });
    };

    return <canvas width={900} height={600} ref={canvasRef}></canvas>;
}
