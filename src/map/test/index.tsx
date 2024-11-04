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
    EdgesGeometry,
    Float32BufferAttribute,
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
import { OrbitControls, MapControls } from "three/examples/jsm/Addons.js";

import vert from "./vert.glsl";
import frag from "./frag.glsl";
import { MeshPhongNodeMaterial } from "three/webgpu";

import { SphereOrbitControlsBack } from "../orbit"

const min_dis = 30;

let low_height = false;

export default function Test() {
    const canvasRef = useRef<HTMLCanvasElement>();

    useEffect(() => {
        const canvas = canvasRef.current;
        run();

        // canvas.addEventListener("pointerdown", (e) => {
        //     canvas.setPointerCapture(e.pointerId)
        //     console.log(e.pointerId, e.pointerType);
        // });
        // canvas.addEventListener("pointermove", (e) => {
        //     console.log(e.pointerId, e.pointerType);
        // });
        // canvas.addEventListener("pointerup", (e) => {
        //     console.log(e.pointerId, e.pointerType);
        // });
    }, []);

    const run = () => {
        const canvas = canvasRef.current;
        const renderer = new WebGLRenderer({ antialias: true, canvas });
        const scene = new Scene();

        const camera = new PerspectiveCamera(75, 1.5, 0.1, 500);
        camera.position.set(0, 0, 50);
        const controls = new SphereOrbitControlsBack(camera, canvas);
        controls.enableDamping = false;
        controls.screenSpacePanning = false
        // controls.maxPolarAngle = Math.PI / 2;
        // controls.enablePan = false;

        const light = new DirectionalLight(0xffffff, 1);
        light.position.set(20, 20, 20);
        const ambient = new AmbientLight(0xffffff, 1);
        scene.add(light, ambient);

        const axis = new AxesHelper(15);
        scene.add(axis);

        const box = new Mesh(new BoxGeometry(10, 10, 10), new MeshPhongMaterial({ color: 0x00ff00 }));
        scene.add(box);
        box.add(axis.clone());
        box.translateX(10);

        const sphere = new Mesh(new IcosahedronGeometry(10), new MeshPhongMaterial({ color: 0xff0000 }))
        scene.add(sphere)

        // controls.target.set(0, 10, 0)
        controls.minPolarAngle = 0
        controls.maxPolarAngle = Math.PI / 2
        controls.minAzimuthAngle = 0
        controls.maxAzimuthAngle = 0
        controls.update()

        controls.addEventListener("end", () => {
            console.log(controls.target.toArray())
        })

        // setTimeout(() => {
        //     const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);
        //     box.quaternion.copy(q);

        //     camera.rotateX(Math.PI / 5);

        //     console.log(camera.up);

        //     setTimeout(() => {
        //         const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);
        //         box.quaternion.copy(q.invert());
        //     }, 2000);
        // }, 2000);

        // const radius = 15;
        // controls.minDistance = radius + 1;
        // const material = new CustomShaderMaterial({
        //     baseMaterial: MeshPhongMaterial,
        //     color: 0x00ff00,
        //     wireframe: true,
        //     vertexShader: /* glsl */ `
        //         attribute float elevation;

        //         void main() {
        //             csm_Position += normal * elevation;
        //         }
        //     `,
        //     fragmentShader: /* glsl */ `

        //     `,
        // });

        // const geometry = new SphereGeometry(radius, 50, 50);
        // const elevations: number[] = [];
        // const count = geometry.getAttribute("position").count;
        // for (let i = 0; i < count; i++) {
        //     elevations.push(Math.random());
        // }
        // geometry.setAttribute("elevation", new Float32BufferAttribute(elevations, 1));

        // const sphere = new Mesh(geometry, material);

        // const cone = new Mesh(
        //     new ConeGeometry(radius, 10, 50),
        //     new MeshPhongMaterial({
        //         color: 0x00ff00,
        //         wireframe: true,
        //     })
        // );

        // scene.add(sphere);

        // let i = 1

        // setInterval(() => {
        //     const v = Math.pow(-1, i)
        //     // camera.up.set(0, 10 * v, 0)
        //     // camera.lookAt(0, 0, 0)

        //     // const { x, y, z } = camera.position
        //     // console.log(x, y, z)
        //     camera.rotation.set(1, 1, 1)
        //     controls.update()
        //     console.log(camera.up.toArray())
        //     i++
        // }, 1000);

        controls.addEventListener("change", () => {
            // const pos = camera.position;
            // const length = pos.length()
            // const toSurface = length - radius;
            // if (toSurface > 20) {
            //     controls.target.set(0, 0, 0)
            //     return
            // }
            // const transition = (1 - (toSurface / 20)) * MAX
            // const vertical = new Vector3(0, length / Math.tan(transition), 0)
            // const target = vertical.clone().sub(pos).normalize().multiplyScalar(10)
            // // const sp = pos.clone().normalize().multiplyScalar(radius)
            // // const normal = sp.clone().normalize()
            // // const forward = 10 * transition
            // // const tp = sp.clone().add(new Vector3(normal.x * forward, normal.y * forward, normal.z * forward))
            // // const ct = new Vector3()
            // // ct.lerpVectors(new Vector3(0, 0, 0), tp, Math.pow(transition, 2))
            // controls.target.copy(target)
        });

        // controls.addEventListener("end", () => {
        //     const dis = camera.position.length() - radius;
        //     console.log(low_height, dis)
        //     if (dis < min_dis && !low_height) {
        //         controls.target.copy(camera.position.clone().normalize().multiplyScalar(radius));

        //         controls.enablePan = true;
        //         controls.minPolarAngle = Math.PI / 3;
        //         controls.minAzimuthAngle = 0
        //         controls.maxAzimuthAngle = 0;
        //         controls.minDistance = 1;
        //         controls.update();
        //         low_height = true
        //     }

        //     if (dis > min_dis && low_height) {
        //         controls.target.copy(new Vector3(0, 0, 0));
        //         controls.enablePan = false;
        //         controls.minPolarAngle = 0;
        //         controls.minAzimuthAngle = Infinity
        //         controls.maxAzimuthAngle = Infinity
        //         controls.minDistance = radius + 1;
        //         controls.update();
        //         low_height = false
        //     }
        // });

        // const axies = new AxesHelper(20);
        // const axies1 = new AxesHelper(5);
        // scene.add(axies);

        // const points = [2, 0, 0, 0, 2, 0, 0, 0, 2, 3, 3,3];
        // const geo = new BufferGeometry();
        // geo.setIndex([0, 1, 2, 1, 2, 3])
        // geo.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
        // const mesh = new Mesh(
        //     geo,
        //     new MeshPhongMaterial({
        //         color: 0xff0000,
        //         side: DoubleSide,
        //     })
        // );
        // mesh.add(axies1);
        // scene.add(mesh);

        // mesh.position.set(3, 3, 3);
        // mesh.rotation.set(0.5, 0.5, 0.5)

        // mesh.rotation.y = 0.5;

        // geo.translate(-3, -3, -3);

        // const plane = new Mesh(new PlaneGeometry(5, 5, 10, 10), new MeshPhysicalMaterial({ color: 0xff0000 }));

        // plane.rotation.y = 0.4

        // const sphere = new Mesh(new SphereGeometry(10, 20, 20), new MeshPhysicalMaterial({ color: 0x00ff00, wireframe: true }));

        // scene.add(plane, sphere)

        // const n = new Vector3(1, 1, 1).normalize()
        // const p = new Vector3(6, 6, 6)

        // const matrix = new Matrix4()
        // matrix.compose(p, new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n), new Vector3(1, 1, 1))
        // plane.applyMatrix4(matrix)

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
            // controls.update();
            // mesh.rotation.y += 0.1
        });
    };

    return <canvas width={900} height={600} ref={canvasRef}></canvas>;
}
