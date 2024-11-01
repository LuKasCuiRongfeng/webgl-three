import { useEffect, useRef } from "react";
import {
    AmbientLight,
    AxesHelper,
    DirectionalLight,
    DoubleSide,
    Float32BufferAttribute,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    InstancedMesh,
    Matrix4,
    MeshPhongMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    Quaternion,
    Scene,
    Vector3,
    WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

export default function InstanceTest() {
    const canvasRef = useRef<HTMLCanvasElement>();

    useEffect(() => {
        const canvas = canvasRef.current;
        const renderer = new WebGLRenderer({ antialias: true, canvas });
        const scene = new Scene();

        const camera = new PerspectiveCamera(75, 1.5, 0.1, 100);
        camera.position.set(0, 0, 20);
        const controls = new OrbitControls(camera, canvas);

        const light = new DirectionalLight(0xffffff, 1);
        light.position.set(20, 20, 20);
        const ambient = new AmbientLight(0xffffff, 1);
        scene.add(light, ambient);

        const axies = new AxesHelper(20);
        const axies1 = new AxesHelper(5);
        scene.add(axies);

        const points = [2, 0, 0, 0, 2, 0, 0, 0, 2];
        const geometry = new InstancedBufferGeometry();
        geometry.instanceCount = 10
        geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(points), 3));

        const mesh = new InstancedMesh(
            geometry,
            new MeshPhongMaterial({
                color: 0xffffff,
                side: DoubleSide
            }),
            10
        );

        scene.add(mesh);

        const matrix = new Matrix4();

        for (let i = 0; i < 10; i++) {
            matrix.compose(
                new Vector3(10 * Math.random(), 10 * Math.random(), 10 * Math.random()),
                new Quaternion().random(),
                new Vector3(1, 1, 1)
            );

            mesh.setMatrixAt(i, matrix.clone());
        }

        renderer.setAnimationLoop(() => {
            renderer.render(scene, camera);
            controls.update();
            // mesh.rotation.y += 0.1
        });
    }, []);

    return <canvas width={900} height={600} ref={canvasRef}></canvas>;
}
