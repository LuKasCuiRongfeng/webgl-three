import {
    Controls,
    MOUSE,
    Quaternion,
    Spherical,
    Vector2,
    Vector3,
    Plane,
    Ray,
    MathUtils,
    PerspectiveCamera,
    OrthographicCamera,
    Matrix4,
} from "three";

const _ray = new Ray();
const _plane = new Plane();
const _TILT_LIMIT = Math.cos(70 * MathUtils.DEG2RAD);

const _v = new Vector3();
const _twoPI = 2 * Math.PI;

export enum CONTROL_STATE {
    NONE = -1,
    ROTATE = 0,
    DOLLY = 1,
    PAN = 2,
}

const _EPS = 0.000001;

type EventMap = {
    start: {};
    change: {};
    end: {};
};

type ControlEventType = { type: keyof EventMap };

const _changeEvent: ControlEventType = { type: "change" };
const _startEvent: ControlEventType = { type: "start" };
const _endEvent: ControlEventType = { type: "end" };

export class SphereOrbitControls extends Controls<EventMap> {
    /** 控件状态 */
    state = CONTROL_STATE.NONE;
    eanbled = true;

    target = new Vector3();

    cursor = new Vector3();

    // 透视相机专用
    minDistance = 0;
    maxDistance = Infinity;

    // 正交相机专用
    minZoom = 0;
    maxZoom = Infinity;

    minTargetRadius = 0;
    maxTargetRadius = Infinity;

    // 旋转时 phi的限制
    minPolarAngle = 0;
    maxPolarAngle = Math.PI;

    // 旋转时 theta 的限制
    minAzimuthAngle = -Infinity;
    maxAzimuthAngle = Infinity;

    // 阻尼衰减
    enableDamping = false;
    dampingFactor = 0.05;

    enableZoom = true;
    zoomSpeed = 1.0;

    enableRotate = true;
    rotateSpeed = 1.0;

    enablePan = true;
    panSpeed = 1.0;

    /**
     * 如果为true， 则相机和target在相机坐标系的xy平面移动
     * 如果为false，则在相机坐标系的xz平面移动
     */
    screenSpacePanning = true;

    keyPanSpeed = 7.0;

    zoomToCursor = false;

    autoRotate = false;
    autoRotateSpeed = 2.0;

    keys = { LEFT: "ArrowLeft", UP: "ArrowUp", RIGHT: "ArrowRight", BOTTOM: "ArrowDown" };

    mouseButtons: Partial<{ LEFT: MOUSE; MIDDLE: MOUSE; RIGHT: MOUSE }> = {
        LEFT: MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN,
    };

    // 用于重置状态
    target0: Vector3;
    position0: Vector3;
    zoom0: number;

    // 记录上次状态
    _lastPosition = new Vector3();
    _lastQuaternion = new Quaternion();
    _lastTargetPosition = new Vector3();

    // 旋转一个角度
    _quat: Quaternion;
    // 取逆，同一个轴按相反方向旋转同一个角度
    _quatInverse: Quaternion;

    /** 以target为球心，相机位置位于球面的球坐标 */
    _spherical = new Spherical();
    _sphericalDelta = new Spherical();

    /** 用于球面平移记录target位置 */
    _sphericalPan = new Spherical();
    _sphericalPanDelta = new Spherical();

    _isTiltZoom = false;
    /** 相机倾斜phi */
    _tiltPhiAngle = 0;
    /** 相机垂直地面的倾角*/
    _tiltOrthAngle = 0;
    /** 相机垂直地面的最大倾角*/
    _tiltMaxAngle = Math.PI / 4;

    _scale = 1;

    _panOffset = new Vector3();

    _rotateStart = new Vector2();
    _rotateEnd = new Vector2();
    _rotateDelta = new Vector2();

    _panStart = new Vector2();
    _panEnd = new Vector2();
    _panDelta = new Vector2();

    // 像素坐标
    _dollyStart = new Vector2();
    _dollyEnd = new Vector2();
    _dollyDelta = new Vector2();
    /** 用于鼠标处缩放，存储相机位置指向鼠标位置的世界坐标的单位向量 */
    _dollyDirection = new Vector3();

    /** 存储当前鼠标的 ndc 坐标 */
    _mouse = new Vector2();

    _performCursorZoom = false;

    _pointers: number[] = [];
    _pointerPositions: Record<number, Vector2> = {};

    _controlActive = false;

    declare object: PerspectiveCamera | OrthographicCamera;
    declare domElement: HTMLCanvasElement;

    constructor(object: PerspectiveCamera | OrthographicCamera, domElement: HTMLCanvasElement, config?: {}) {
        super(object, domElement);

        // 用于重置状态
        this.target0 = this.target.clone();
        this.position0 = this.object.position.clone();
        this.zoom0 = this.object.zoom;

        // 纠正相机形态，始终保持 Y+ 是相机的上方
        this._quat = new Quaternion().setFromUnitVectors(object.up, new Vector3(0, 1, 0));

        // 求逆，代表相反旋转
        this._quatInverse = this._quat.clone().invert();

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);

        this.onContextMenu = this.onContextMenu.bind(this);

        this.onMouseWheel = this.onMouseWheel.bind(this);

        this.onKeyDown = this.onKeyDown.bind(this);

        if (this.domElement !== null) {
            this.connect();
        }

        this.update();
    }

    connect() {
        this.domElement.addEventListener("pointerdown", this.onPointerDown);
        this.domElement.addEventListener("pointercancel", this.onPointerUp);

        this.domElement.addEventListener("contextmenu", this.onContextMenu);

        this.domElement.addEventListener("wheel", this.onMouseWheel, { passive: false });

        this.domElement.addEventListener("keydown", this.onKeyDown);
    }

    disconnect() {
        this.domElement.removeEventListener("pointerdown", this.onPointerDown);
        this.domElement.removeEventListener("pointermove", this.onPointerMove);
        this.domElement.removeEventListener("pointerup", this.onPointerUp);
        this.domElement.removeEventListener("pointercancel", this.onPointerUp);

        this.domElement.removeEventListener("wheel", this.onMouseWheel);
        this.domElement.removeEventListener("contextmenu", this.onContextMenu);

        this.domElement.removeEventListener("keydown", this.onKeyDown);
    }

    dispose() {
        this.disconnect();
    }

    private onPointerDown(event: PointerEvent) {
        if (this.enabled === false) return;

        if (this._pointers.length === 0) {
            this.domElement.setPointerCapture(event.pointerId);

            this.domElement.addEventListener("pointermove", this.onPointerMove);
            this.domElement.addEventListener("pointerup", this.onPointerUp);
        }

        if (this._isTrackingPointer(event)) return;

        this._addPointer(event);

        this.onMouseDown(event);
    }

    private onMouseDown(event: MouseEvent) {
        let mouseAction: MOUSE;

        switch (event.button) {
            case 0:
                mouseAction = this.mouseButtons.LEFT;
                break;

            case 1:
                mouseAction = this.mouseButtons.MIDDLE;
                break;

            case 2:
                mouseAction = this.mouseButtons.RIGHT;
                break;

            default:
        }

        switch (mouseAction) {
            case MOUSE.DOLLY:
                if (this.enableZoom === false) return;
                this._handleMouseDownDolly(event);
                this.state = CONTROL_STATE.DOLLY;
                break;

            // rotate 和 pan 按住 ctrl or meta or shift 可以切换操作
            case MOUSE.ROTATE:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    if (this.enablePan === false) return;
                    this._handleMouseDownPan(event);
                    this.state = CONTROL_STATE.PAN;
                } else {
                    if (this.enableRotate === false) return;
                    this._handleMouseDownRotate(event);
                    this.state = CONTROL_STATE.ROTATE;
                }
                break;

            case MOUSE.PAN:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    if (this.enableRotate === false) return;
                    this._handleMouseDownRotate(event);
                    this.state = CONTROL_STATE.ROTATE;
                } else {
                    if (this.enablePan === false) return;
                    this._handleMouseDownPan(event);
                    this.state = CONTROL_STATE.PAN;
                }
                break;

            default:
                this.state = CONTROL_STATE.NONE;
        }

        if (this.state !== CONTROL_STATE.NONE) {
            this.dispatchEvent(_startEvent);
        }
    }

    private onPointerMove(event: PointerEvent) {
        if (this.enabled === false) return;
        this.onMouseMove(event);
    }

    private onMouseMove(event: MouseEvent) {
        switch (this.state) {
            case CONTROL_STATE.ROTATE:
                if (this.enableRotate === false) return;
                this._handleMouseMoveRotate(event);
                break;

            case CONTROL_STATE.DOLLY:
                if (this.enableZoom === false) return;
                this._handleMouseMoveDolly(event);
                break;

            case CONTROL_STATE.PAN:
                if (this.enablePan === false) return;
                this._handleMouseMovePan(event);
                break;
        }
    }

    private onPointerUp(event: PointerEvent) {
        this._removePointer(event);

        this.domElement.releasePointerCapture(event.pointerId);
        this.domElement.removeEventListener("pointermove", this.onPointerMove);
        this.domElement.removeEventListener("pointerup", this.onPointerUp);

        this.dispatchEvent(_endEvent);

        this.state = CONTROL_STATE.NONE;
    }

    private onMouseWheel(event: WheelEvent) {
        if (this.enabled === false || this.enableZoom === false || this.state !== CONTROL_STATE.NONE) return;

        event.preventDefault();

        this.dispatchEvent(_startEvent);

        // @ts-ignore
        this._handleMouseWheel(this._customWheelEvent(event));

        this.dispatchEvent(_endEvent);
    }

    private onKeyDown(event: KeyboardEvent) {
        if (this.enabled === false || this.enablePan === false) return;

        this._handleKeyDown(event);
    }

    private onContextMenu(event: MouseEvent) {
        if (this.enabled === false) return;
        event.preventDefault();
    }

    getPolarAngle() {
        return this._spherical.phi;
    }

    getAzimuthalAngle() {
        return this._spherical.theta;
    }

    getDistance() {
        return this.object.position.distanceTo(this.target);
    }

    saveState() {
        this.target0.copy(this.target);
        this.position0.copy(this.object.position);
        this.zoom0 = this.object.zoom;
    }

    reset() {
        this.target.copy(this.target0);
        this.object.position.copy(this.position0);
        this.object.zoom = this.zoom0;

        this.object.updateProjectionMatrix();
        this.dispatchEvent(_changeEvent);

        this.update();

        this.state = CONTROL_STATE.NONE;
    }

    update(deltaTime?: number) {
        const position = this.object.position;

        _v.copy(position).sub(this.target);

        // 保证相机上方上 Y+
        _v.applyQuaternion(this._quat);

        // angle from z-axis around y-axis
        this._spherical.setFromVector3(_v);

        // 记录sphere 平移时的target
        this._sphericalPan.setFromVector3(this.target.clone());

        if (this.autoRotate && this.state === CONTROL_STATE.NONE) {
            this._rotateLeft(this._getAutoRotationAngle(deltaTime));
        }

        if (this.enableDamping) {
            this._spherical.theta += this._sphericalDelta.theta * this.dampingFactor;
            this._spherical.phi += this._sphericalDelta.phi * this.dampingFactor;
        } else {
            this._spherical.theta += this._sphericalDelta.theta;
            this._spherical.phi += this._sphericalDelta.phi;

            this._sphericalPan.theta += this._sphericalPanDelta.theta;
            this._sphericalPan.phi += this._sphericalPanDelta.phi;
        }

        // 限制theta角度
        let min = this.minAzimuthAngle;
        let max = this.maxAzimuthAngle;

        if (isFinite(min) && isFinite(max)) {
            if (min < -Math.PI) min += _twoPI;
            else if (min > Math.PI) min -= _twoPI;

            if (max < -Math.PI) max += _twoPI;
            else if (max > Math.PI) max -= _twoPI;

            if (min <= max) {
                this._spherical.theta = Math.max(min, Math.min(max, this._spherical.theta));
            } else {
                // 如果设置为min > max
                // 则把theta设置为端点，靠经哪个端点就设置为那个
                this._spherical.theta =
                    this._spherical.theta > (min + max) / 2
                        ? Math.max(min, this._spherical.theta)
                        : Math.min(max, this._spherical.theta);
            }
        }

        // restrict phi to be between desired limits
        this._spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this._spherical.phi));

        // 限制 phi 到 0 ~ pi
        this._spherical.makeSafe();

        this._sphericalPan.makeSafe();

        // pan 移动target
        if (this.enableDamping === true) {
            this.target.addScaledVector(this._panOffset, this.dampingFactor);
        } else {
            this.target.add(this._panOffset);
        }

        // Limit the target distance from the cursor to create a sphere around the center of interest
        // 限制target的移动范围到这个设置的cursor为中心的球体内部
        this.target.sub(this.cursor);
        this.target.clampLength(this.minTargetRadius, this.maxTargetRadius);
        this.target.add(this.cursor);

        if (this.enableZoom && this._isTiltZoom) {
            this._spherical.phi = this._tiltPhiAngle;
        }

        let zoomChanged = false;
        // adjust the camera position based on zoom only if we're not zooming to the cursor or if it's an ortho camera
        // we adjust zoom later in these cases
        if ((this.zoomToCursor && this._performCursorZoom) || this.object instanceof OrthographicCamera) {
            this._spherical.radius = this._clampDistance(this._spherical.radius);
        } else {
            const prevRadius = this._spherical.radius;
            this._spherical.radius = this._clampDistance(this._spherical.radius * this._scale);
            zoomChanged = prevRadius != this._spherical.radius;
        }

        _v.setFromSpherical(this._spherical);

        // rotate offset back to "camera-up-vector-is-up" space
        _v.applyQuaternion(this._quatInverse);

        position.copy(this.target).add(_v);

        // 球面平移
        if (this.enablePan && this.state === CONTROL_STATE.PAN) {
            const length = this.target.distanceTo(position);
            this.target.setFromSpherical(this._sphericalPan);
            const nt = this.target.clone();

            const yp = new Vector3(0, 1, 0);
            const angle = nt.angleTo(yp);

            const yn = new Vector3(0, 1, 0).multiplyScalar(nt.length() / Math.cos(angle));
            // angle 如果小于 pi/2，则位于北半球，orth方向垂直向外
            // 如果大于 pi/2，则位于南半球，orth方向垂直向内
            const orth = nt.clone().cross(yn).normalize();

            const tCamera = nt.clone().sub(yn).normalize().multiplyScalar(length);
            const dir = nt.y >= 0 ? 1 : -1;
            // 在旋转个角度
            const quaternion = new Quaternion().setFromAxisAngle(
                orth.multiplyScalar(dir),
                Math.PI / 2 - this._tiltOrthAngle
            );
            tCamera.applyQuaternion(quaternion);
            if (dir === 1) {
                position.copy(nt.add(tCamera));
            } else {
                position.copy(nt.sub(tCamera));
            }
        }

        this.object.lookAt(this.target);

        if (this.enableDamping === true) {
            this._sphericalDelta.theta *= 1 - this.dampingFactor;
            this._sphericalDelta.phi *= 1 - this.dampingFactor;

            this._panOffset.multiplyScalar(1 - this.dampingFactor);
        } else {
            this._sphericalDelta.set(0, 0, 0);

            this._panOffset.set(0, 0, 0);

            this._sphericalPanDelta.set(0, 0, 0);
        }

        // adjust camera position
        if (this.zoomToCursor && this._performCursorZoom) {
            let newRadius = null;
            if (this.object instanceof PerspectiveCamera) {
                // move the camera down the pointer ray
                // this method avoids floating point error
                const prevRadius = _v.length();
                newRadius = this._clampDistance(prevRadius * this._scale);

                const radiusDelta = prevRadius - newRadius;
                this.object.position.addScaledVector(this._dollyDirection, radiusDelta);
                this.object.updateMatrixWorld();

                zoomChanged = !!radiusDelta;
            } else if (this.object instanceof OrthographicCamera) {
                // adjust the ortho camera position based on zoom changes
                const mouseBefore = new Vector3(this._mouse.x, this._mouse.y, 0);
                mouseBefore.unproject(this.object);

                const prevZoom = this.object.zoom;
                this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / this._scale));
                this.object.updateProjectionMatrix();

                zoomChanged = prevZoom !== this.object.zoom;

                const mouseAfter = new Vector3(this._mouse.x, this._mouse.y, 0);
                mouseAfter.unproject(this.object);

                this.object.position.sub(mouseAfter).add(mouseBefore);
                this.object.updateMatrixWorld();

                newRadius = _v.length();
            } else {
                console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.");
                this.zoomToCursor = false;
            }

            // handle the placement of the target
            if (newRadius !== null) {
                if (this.screenSpacePanning) {
                    // position the orbit target in front of the new camera position
                    // 计算相机改变位置后，target的新位置
                    // 相机逐渐向鼠标位置靠近，同时平移改变target，保持相机朝向不变
                    this.target
                        // 假定的最初始相机的朝向
                        .set(0, 0, -1)
                        // 应用相机的旋转
                        .transformDirection(this.object.matrix)
                        .multiplyScalar(newRadius)
                        .add(this.object.position);
                } else {
                    // get the ray and translation plane to compute target
                    _ray.origin.copy(this.object.position);
                    _ray.direction.set(0, 0, -1).transformDirection(this.object.matrix);

                    // if the camera is 20 degrees above the horizon then don't adjust the focus target to avoid
                    // extremely large values
                    if (Math.abs(this.object.up.dot(_ray.direction)) < _TILT_LIMIT) {
                        this.object.lookAt(this.target);
                    } else {
                        _plane.setFromNormalAndCoplanarPoint(this.object.up, this.target);
                        _ray.intersectPlane(_plane, this.target);
                    }
                }
            }
        } else if (this.object instanceof OrthographicCamera) {
            const prevZoom = this.object.zoom;
            this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / this._scale));

            if (prevZoom !== this.object.zoom) {
                this.object.updateProjectionMatrix();
                zoomChanged = true;
            }
        }

        this._scale = 1;
        this._performCursorZoom = false;

        // update condition is:
        // min(camera displacement, camera rotation in radians)^2 > EPS
        // using small-angle approximation cos(x/2) = 1 - x^2 / 8

        if (
            zoomChanged ||
            this._lastPosition.distanceToSquared(this.object.position) > _EPS ||
            8 * (1 - this._lastQuaternion.dot(this.object.quaternion)) > _EPS ||
            this._lastTargetPosition.distanceToSquared(this.target) > _EPS
        ) {
            this.dispatchEvent(_changeEvent);

            this._lastPosition.copy(this.object.position);
            this._lastQuaternion.copy(this.object.quaternion);
            this._lastTargetPosition.copy(this.target);

            return true;
        }

        return false;
    }

    _getAutoRotationAngle(deltaTime?: number) {
        if (deltaTime !== null) {
            return (_twoPI / 60) * this.autoRotateSpeed * deltaTime;
        } else {
            return (_twoPI / 60 / 60) * this.autoRotateSpeed;
        }
    }

    /** 基于鼠标滑动的差值计算一个合适的缩放值
     * 返回的值 < 1
     * 减函数，差值越大，返回的值越小
     */
    _getZoomScale(delta: number) {
        const normalizedDelta = Math.abs(delta * 0.01);
        // 这个指数函数是减函数，返回的值 < 1
        return Math.pow(0.95, this.zoomSpeed * normalizedDelta);
    }

    _rotateLeft(angle: number) {
        // 物体视觉上逆时针旋转，那么相机需要顺时针旋转
        this._sphericalDelta.theta -= angle;
    }

    _rotateUp(angle: number) {
        this._sphericalDelta.phi -= angle;
    }

    _panLeft(distance: number, objectMatrix: Matrix4) {
        _v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
        _v.multiplyScalar(-distance);

        this._panOffset.add(_v);
    }

    _panSphereLeft(angle: number) {
        this._sphericalPanDelta.theta -= angle;
    }

    _panUp(distance: number, objectMatrix: Matrix4) {
        if (this.screenSpacePanning === true) {
            _v.setFromMatrixColumn(objectMatrix, 1);
        } else {
            _v.setFromMatrixColumn(objectMatrix, 0);
            _v.crossVectors(this.object.up, _v);
        }

        _v.multiplyScalar(distance);

        this._panOffset.add(_v);
    }

    _panSphereUp(angle: number) {
        this._sphericalPanDelta.phi -= angle;
    }

    // deltaX and deltaY are in pixels; right and down are positive
    _pan(deltaX: number, deltaY: number) {
        const element = this.domElement;

        if (this.object instanceof PerspectiveCamera) {
            // 走球面平移
            this._panSphereLeft((_twoPI * deltaX) / element.clientHeight);
            this._panSphereUp((_twoPI * deltaY) / element.clientHeight);
        } else if (this.object instanceof OrthographicCamera) {
            // orthographic
            this._panLeft(
                (deltaX * (this.object.right - this.object.left)) / this.object.zoom / element.clientWidth,
                this.object.matrix
            );
            this._panUp(
                (deltaY * (this.object.top - this.object.bottom)) / this.object.zoom / element.clientHeight,
                this.object.matrix
            );
        } else {
            // camera neither orthographic nor perspective
            console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.");
            this.enablePan = false;
        }
    }

    _dollyOut(dollyScale: number) {
        if (this.object instanceof PerspectiveCamera || this.object instanceof OrthographicCamera) {
            this._scale /= dollyScale;
        } else {
            console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.");
            this.enableZoom = false;
        }
    }

    _dollyIn(dollyScale: number) {
        if (this.object instanceof PerspectiveCamera || this.object instanceof OrthographicCamera) {
            this._scale *= dollyScale;
        } else {
            console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.");
            this.enableZoom = false;
        }
    }

    _getNdcByPixel(x: number, y: number, z = 1) {
        const rect = this.domElement.getBoundingClientRect();
        const dx = x - rect.left;
        const dy = y - rect.top;
        const w = rect.width;
        const h = rect.height;

        return new Vector3((dx / w) * 2 - 1, -(dy / h) * 2 + 1, z)
    }

    /** 更新基于鼠标位置缩放的参数，主要是鼠标的ndc坐标和缩放方向 */
    _updateZoomParameters(x: number, y: number) {
        if (!this.zoomToCursor) {
            return;
        }

        this._performCursorZoom = true;

        const rect = this.domElement.getBoundingClientRect();
        const dx = x - rect.left;
        const dy = y - rect.top;
        const w = rect.width;
        const h = rect.height;

        // screen space 转 ndc
        this._mouse.x = (dx / w) * 2 - 1;
        this._mouse.y = -(dy / h) * 2 + 1;

        // 有相机位置指向鼠标位置的世界坐标
        this._dollyDirection
            // 深度值设为视锥的最远处，z = 1
            .set(this._mouse.x, this._mouse.y, 1)
            .unproject(this.object)
            .sub(this.object.position)
            .normalize();
    }

    /** 限制到最大最小距离范围内 */
    _clampDistance(dist: number) {
        return Math.max(this.minDistance, Math.min(this.maxDistance, dist));
    }

    //
    // event callbacks - update the object state
    //

    _handleMouseDownRotate(event: MouseEvent) {
        this._rotateStart.set(event.clientX, event.clientY);
    }

    _handleMouseDownDolly(event: MouseEvent) {
        this._updateZoomParameters(event.clientX, event.clientX);
        // 记下缩放像素起始位置
        this._dollyStart.set(event.clientX, event.clientY);
    }

    _handleMouseDownPan(event: MouseEvent) {
        this._panStart.set(event.clientX, event.clientY);
    }

    _handleMouseMoveRotate(event: MouseEvent) {
        this._rotateEnd.set(event.clientX, event.clientY);

        this._rotateDelta.subVectors(this._rotateEnd, this._rotateStart).multiplyScalar(this.rotateSpeed);

        const element = this.domElement;

        // 按照比例计算这个差值该旋转多少角度
        this._rotateLeft((_twoPI * this._rotateDelta.x) / element.clientHeight); // yes, height

        this._rotateUp((_twoPI * this._rotateDelta.y) / element.clientHeight);

        this._rotateStart.copy(this._rotateEnd);

        this.update();
    }

    _handleMouseMoveDolly(event: MouseEvent) {
        this._dollyEnd.set(event.clientX, event.clientY);

        this._dollyDelta.subVectors(this._dollyEnd, this._dollyStart);

        // 根据鼠标向上还是向下决定缩放方向
        if (this._dollyDelta.y > 0) {
            // 鼠标下滑
            this._dollyOut(this._getZoomScale(this._dollyDelta.y));
        } else if (this._dollyDelta.y < 0) {
            // 鼠标上滑
            this._dollyIn(this._getZoomScale(this._dollyDelta.y));
        }

        this._dollyStart.copy(this._dollyEnd);

        this.update();
    }

    _handleMouseMovePan(event: MouseEvent) {
        this._panEnd.set(event.clientX, event.clientY);

        // 直接把 panSpeed = 1，根据像素计算该pan多少角度
        const start = this._getNdcByPixel(this._panStart.x, this._panStart.y)
        const end = this._getNdcByPixel(this._panEnd.x, this._panEnd.y)
        this._panDelta.subVectors(this._panEnd, this._panStart).multiplyScalar(this.panSpeed);

        this._pan(this._panDelta.x, this._panDelta.y);

        this._panStart.copy(this._panEnd);

        this.update();
    }

    _handleMouseWheel(event: WheelEvent) {
        this._updateZoomParameters(event.clientX, event.clientY);

        if (event.deltaY < 0) {
            this._dollyIn(this._getZoomScale(event.deltaY));
        } else if (event.deltaY > 0) {
            this._dollyOut(this._getZoomScale(event.deltaY));
        }

        this.update();
    }

    _handleKeyDown(event: KeyboardEvent) {
        let needsUpdate = false;

        switch (event.code) {
            case this.keys.UP:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    this._rotateUp((_twoPI * this.rotateSpeed) / this.domElement.clientHeight);
                } else {
                    this._pan(0, this.keyPanSpeed);
                }

                needsUpdate = true;
                break;

            case this.keys.BOTTOM:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    this._rotateUp((-_twoPI * this.rotateSpeed) / this.domElement.clientHeight);
                } else {
                    this._pan(0, -this.keyPanSpeed);
                }

                needsUpdate = true;
                break;

            case this.keys.LEFT:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    this._rotateLeft((_twoPI * this.rotateSpeed) / this.domElement.clientHeight);
                } else {
                    this._pan(this.keyPanSpeed, 0);
                }

                needsUpdate = true;
                break;

            case this.keys.RIGHT:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    this._rotateLeft((-_twoPI * this.rotateSpeed) / this.domElement.clientHeight);
                } else {
                    this._pan(-this.keyPanSpeed, 0);
                }

                needsUpdate = true;
                break;
        }

        if (needsUpdate) {
            // prevent the browser from scrolling on cursor keys
            event.preventDefault();

            this.update();
        }
    }

    // pointers

    _addPointer(event: PointerEvent) {
        this._pointers.push(event.pointerId);
    }

    _removePointer(event: PointerEvent) {
        delete this._pointerPositions[event.pointerId];

        for (let i = 0; i < this._pointers.length; i++) {
            if (this._pointers[i] == event.pointerId) {
                this._pointers.splice(i, 1);
                return;
            }
        }
    }

    /** pointer event 是否已经捕获canvas */
    _isTrackingPointer(event: PointerEvent) {
        for (let i = 0; i < this._pointers.length; i++) {
            if (this._pointers[i] == event.pointerId) return true;
        }

        return false;
    }

    //

    _customWheelEvent(event: WheelEvent) {
        const mode = event.deltaMode;

        // minimal wheel event altered to meet delta-zoom demand
        const newEvent = {
            clientX: event.clientX,
            clientY: event.clientY,
            deltaY: event.deltaY,
        };

        switch (mode) {
            case 1: // LINE_MODE
                newEvent.deltaY *= 16;
                break;

            case 2: // PAGE_MODE
                newEvent.deltaY *= 100;
                break;
        }

        // detect if event was triggered by pinching
        if (event.ctrlKey && !this._controlActive) {
            newEvent.deltaY *= 10;
        }

        return newEvent;
    }

    /**
     * @param angle 相机和地面垂直轴的夹角
     */
    setCameraAngle(angle: number) {
        const n = this.target.clone().normalize();
        // 在北半球 0< a < PI/2
        // 在南半球 pi/2 < a < pi
        const a = n.angleTo(new Vector3(0, 1, 0));
        this._tiltPhiAngle = angle + a;
        this._tiltOrthAngle = angle;
    }

    setIsTiltZoom(tileZoom: boolean) {
        this._isTiltZoom = tileZoom;
    }

    setMaxCameraAngle(angle: number) {
        this._tiltMaxAngle = angle;
    }
}
