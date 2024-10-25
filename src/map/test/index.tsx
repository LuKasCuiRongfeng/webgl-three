import { useEffect, useRef } from "react";
import {
    AmbientLight,
    AxesHelper,
    BufferAttribute,
    BufferGeometry,
    DirectionalLight,
    DoubleSide,
    EdgesGeometry,
    FrontSide,
    IcosahedronGeometry,
    LineBasicMaterial,
    LineSegments,
    Matrix4,
    Mesh,
    MeshPhongMaterial,
    MeshPhysicalMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    Quaternion,
    Scene,
    SphereGeometry,
    Vector3,
    WebGLRenderer,
} from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { OrbitControls } from "three/examples/jsm/Addons.js";

import vert from "./vert.glsl";
import frag from "./frag.glsl";

export default function Test() {
    const canvasRef = useRef<HTMLCanvasElement>();

    useEffect(() => {
        run();
    }, []);

    const run = () => {
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
        const geo = new BufferGeometry();
        geo.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
        const mesh = new Mesh(
            geo,
            new MeshPhongMaterial({
                color: 0xff0000,
                side: DoubleSide,
            })
        );
        mesh.add(axies1);
        scene.add(mesh);

        mesh.position.set(3, 3, 3);

        mesh.rotation.y = 0.5;

        geo.translate(-3, -3, -3);

        console.log(mesh.position);

        const plane = new Mesh(new PlaneGeometry(5, 5, 10, 10), new MeshPhysicalMaterial({ color: 0xff0000 }));

        plane.rotation.y = 0.4

        const sphere = new Mesh(new SphereGeometry(10, 20, 20), new MeshPhysicalMaterial({ color: 0x00ff00, wireframe: true }));

        scene.add(plane, sphere)

        const n = new Vector3(1, 1, 1).normalize()
        const p = new Vector3(6, 6, 6)

        const matrix = new Matrix4()
        matrix.compose(p, new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n), new Vector3(1, 1, 1))
        plane.applyMatrix4(matrix)

        // const targetP = new Vector3(5, 5, 5);
        // const n = new Vector3(2, 2, 2).normalize();

        // const plane = new Mesh(
        //     new PlaneGeometry(5, 5, 10, 10),
        //     new MeshPhongMaterial({
        //         color: 0xffffff,
        //         wireframe: true,
        //         side: FrontSide
        //     })
        // );
        // scene.add(plane);
        // plane.add(axies1)
        // // plane.add(axies.clone())

        // const origin = new Vector3(0, 0, 10)

        // plane.position.copy(origin)

        // const clonePlane = plane.clone()

        // clonePlane.position.set(5, 5, 5)

        // clonePlane.rotation.y = 0.5

        // clonePlane.scale.x = 2

        // scene.add(clonePlane)

        // setTimeout(() => {
        //     const matrix = new Matrix4();
        //     // matrix.compose(targetP, new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n), new Vector3(1, 1, 1));
        //     // plane.applyMatrix4(clonePlane.matrix.clone());
        //     // plane.applyMatrix4(clonePlane.matrix.clone())
        //     clonePlane.matrix.decompose(plane.position, plane.quaternion, plane.scale)

        //     // plane.position.set(5, 5, 5)

        //     console.log(plane.position, clonePlane.position)
        // }, 2000);

        // const geometry = new IcosahedronGeometry(10, 32)
        // const count = geometry.getAttribute("position").count
        // const elevations: number[] = []
        // const face: number[] = []
        // let elevation = 0
        // let faceIndex = 0
        // for (let i = 0; i < count; i++) {
        //     if (i % 3 === 0) {
        //         elevation = Math.random() * 2.0
        //         faceIndex = Math.round(i / 3)
        //     }

        //     elevations.push(elevation)
        //     face.push(faceIndex)
        // }
        // geometry.setAttribute("elevation", new BufferAttribute(new Float32Array(elevations), 1))
        // geometry.setAttribute("face", new BufferAttribute(new Float32Array(face), 1))

        // const material = new CustomShaderMaterial({
        //     baseMaterial: MeshPhongMaterial,
        //     color: 0x00ff00,
        //     wireframe: true,
        //     vertexShader: vert,
        //     fragmentShader: frag
        // })

        // const mesh = new Mesh(geometry, material)
        // scene.add(mesh)

        // const line = new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial({ color: 0x0000ff }))
        // scene.add(line)

        renderer.setAnimationLoop(() => {
            renderer.render(scene, camera);
            controls.update();
            // mesh.rotation.y += 0.1
        });
    };

    return <canvas width={900} height={600} ref={canvasRef}></canvas>;
}
