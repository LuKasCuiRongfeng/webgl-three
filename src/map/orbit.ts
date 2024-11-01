import {
    Controls,
    MOUSE,
    Quaternion,
    Spherical,
    TOUCH,
    Vector2,
    Vector3,
    Plane,
    Ray,
    MathUtils,
    Camera,
    PerspectiveCamera,
    Object3D,
    Object3DEventMap,
	OrthographicCamera,
} from "three";

const _ray = new Ray();
const _plane = new Plane();
const _TILT_LIMIT = Math.cos(70 * MathUtils.DEG2RAD);

const _v = new Vector3();
const _twoPI = 2 * Math.PI;

enum STATE {
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

class SphereOrbitControls extends Controls<EventMap> {
    state = STATE.NONE;
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

    minPolarAngle = 0;
    maxPolarAngle = Math.PI;

    minAzimuthAngle = -Infinity;
    maxAzimuthAngle = Infinity;

    enableDamping = false;
    dampingFactor = 0.05;

    enableZoom = true;
    zoomSpeed = 1.0;

    enableRotate = true;
    rotateSpeed = 1.0;

    enablePan = true;
    panSpeed = 1.0;
    screenSpacePanning = true;

    keyPanSpeed = 7.0;

    zoomToCursor = false;

    autoRotate = false;
    autoRotateSpeed = 2.0;

    keys = { LEFT: "ArrowLeft", UP: "ArrowUp", RIGHT: "ArrowRight", BOTTOM: "ArrowDown" };

    mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };

    // reset
    target0: Vector3;
    position0: Vector3;
    zoom0: number;

    // 鼠标事件对象
    _domElementKeyEvents: HTMLElement;

    // 记录上次状态
    _lastPosition = new Vector3();
    _lastQuaternion = new Quaternion();
    _lastTargetPosition = new Vector3();

	// 旋转一个角度
    _quat: Quaternion;
    // 取逆，同一个轴按相反方向旋转同一个角度
    _quatInverse: Quaternion;

    _spherical = new Spherical();
    _sphericalDelta = new Spherical();

    _scale = 1;

    _panOffset = new Vector3();

    _rotateStart = new Vector2();
    _rotateEnd = new Vector2();
    _rotateDelta = new Vector2();
    _panStart = new Vector2();
    _panEnd = new Vector2();
    _panDelta = new Vector2();
    _dollyStart = new Vector2();
    _dollyEnd = new Vector2();
    _dollyDelta = new Vector2();
    _dollyDirection = new Vector3();
    _mouse = new Vector2();
    _performCursorZoom = false;
    _pointers: number[] = [];
    _pointerPositions = {};

    _controlActive = false;

    declare object: PerspectiveCamera;
    declare domElement: HTMLCanvasElement;

    constructor(object: PerspectiveCamera, domElement: HTMLCanvasElement) {
        super(object, domElement);

        // for reset
        this.target0 = this.target.clone();
        this.position0 = this.object.position.clone();
        this.zoom0 = this.object.zoom;

        // 始终保持 Y+ 是相机的上方
        this._quat = new Quaternion().setFromUnitVectors(object.up, new Vector3(0, 1, 0));

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
                this.state = STATE.DOLLY;
                break;

            case MOUSE.ROTATE:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    if (this.enablePan === false) return;
                    this._handleMouseDownPan(event);
                    this.state = STATE.PAN;
                } else {
                    if (this.enableRotate === false) return;
                    this._handleMouseDownRotate(event);
                    this.state = STATE.ROTATE;
                }
                break;

            case MOUSE.PAN:
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    if (this.enableRotate === false) return;
                    this._handleMouseDownRotate(event);
                    this.state = STATE.ROTATE;
                } else {
                    if (this.enablePan === false) return;
                    this._handleMouseDownPan(event);
                    this.state = STATE.PAN;
                }
                break;

            default:
                this.state = STATE.NONE;
        }

        if (this.state !== STATE.NONE) {
            this.dispatchEvent(_startEvent);
        }
    }

    private onPointerMove(event: PointerEvent) {
        if (this.enabled === false) return;
        this.onMouseMove(event);
    }

    private onMouseMove(event: MouseEvent) {
        switch (this.state) {
            case STATE.ROTATE:
                if (this.enableRotate === false) return;
                this._handleMouseMoveRotate(event);
                break;

            case STATE.DOLLY:
                if (this.enableZoom === false) return;
                this._handleMouseMoveDolly(event);
                break;

            case STATE.PAN:
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

        this.state = STATE.NONE;
    }

    private onMouseWheel(event: WheelEvent) {
        if (this.enabled === false || this.enableZoom === false || this.state !== STATE.NONE) return;

        event.preventDefault();

        this.dispatchEvent(_startEvent);

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

    dispose() {
        this.disconnect();
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

        this.state = STATE.NONE;
    }

    update(deltaTime?: number) {
        const position = this.object.position;

        _v.copy(position).sub(this.target);

        // 保证相机上方上 Y+
        _v.applyQuaternion(this._quat);

        // angle from z-axis around y-axis
        this._spherical.setFromVector3(_v);

        if (this.autoRotate && this.state === STATE.NONE) {
            this._rotateLeft(this._getAutoRotationAngle(deltaTime));
        }

        if (this.enableDamping) {
            this._spherical.theta += this._sphericalDelta.theta * this.dampingFactor;
            this._spherical.phi += this._sphericalDelta.phi * this.dampingFactor;
        } else {
            this._spherical.theta += this._sphericalDelta.theta;
            this._spherical.phi += this._sphericalDelta.phi;
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

        // pan 移动target
        if (this.enableDamping === true) {
            this.target.addScaledVector(this._panOffset, this.dampingFactor);
        } else {
            this.target.add(this._panOffset);
        }

        // Limit the target distance from the cursor to create a sphere around the center of interest
        this.target.sub(this.cursor);
        this.target.clampLength(this.minTargetRadius, this.maxTargetRadius);
        this.target.add(this.cursor);

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

        this.object.lookAt(this.target);

        if (this.enableDamping === true) {
            this._sphericalDelta.theta *= 1 - this.dampingFactor;
            this._sphericalDelta.phi *= 1 - this.dampingFactor;

            this._panOffset.multiplyScalar(1 - this.dampingFactor);
        } else {
            this._sphericalDelta.set(0, 0, 0);

            this._panOffset.set(0, 0, 0);
        }

        // adjust camera position
        if (this.zoomToCursor && this._performCursorZoom) {
            let newRadius = null;
            if (this.object.isPerspectiveCamera) {
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
                    this.target
                        .set(0, 0, -1)
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

    _getAutoRotationAngle(deltaTime) {
        if (deltaTime !== null) {
            return (_twoPI / 60) * this.autoRotateSpeed * deltaTime;
        } else {
            return (_twoPI / 60 / 60) * this.autoRotateSpeed;
        }
    }

    _getZoomScale(delta) {
        const normalizedDelta = Math.abs(delta * 0.01);
        return Math.pow(0.95, this.zoomSpeed * normalizedDelta);
    }

    _rotateLeft(angle) {
        this._sphericalDelta.theta -= angle;
    }

    _rotateUp(angle) {
        this._sphericalDelta.phi -= angle;
    }

    _panLeft(distance, objectMatrix) {
        _v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
        _v.multiplyScalar(-distance);

        this._panOffset.add(_v);
    }

    _panUp(distance, objectMatrix) {
        if (this.screenSpacePanning === true) {
            _v.setFromMatrixColumn(objectMatrix, 1);
        } else {
            _v.setFromMatrixColumn(objectMatrix, 0);
            _v.crossVectors(this.object.up, _v);
        }

        _v.multiplyScalar(distance);

        this._panOffset.add(_v);
    }

    // deltaX and deltaY are in pixels; right and down are positive
    _pan(deltaX, deltaY) {
        const element = this.domElement;

        if (this.object.isPerspectiveCamera) {
            // perspective
            const position = this.object.position;
            _v.copy(position).sub(this.target);
            let targetDistance = _v.length();

            // half of the fov is center to top of screen
            targetDistance *= Math.tan(((this.object.fov / 2) * Math.PI) / 180.0);

            // we use only clientHeight here so aspect ratio does not distort speed
            this._panLeft((2 * deltaX * targetDistance) / element.clientHeight, this.object.matrix);
            this._panUp((2 * deltaY * targetDistance) / element.clientHeight, this.object.matrix);
        } else if (this.object.isOrthographicCamera) {
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

    _dollyOut(dollyScale) {
        if (this.object.isPerspectiveCamera || this.object.isOrthographicCamera) {
            this._scale /= dollyScale;
        } else {
            console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.");
            this.enableZoom = false;
        }
    }

    _dollyIn(dollyScale) {
        if (this.object.isPerspectiveCamera || this.object.isOrthographicCamera) {
            this._scale *= dollyScale;
        } else {
            console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.");
            this.enableZoom = false;
        }
    }

    _updateZoomParameters(x, y) {
        if (!this.zoomToCursor) {
            return;
        }

        this._performCursorZoom = true;

        const rect = this.domElement.getBoundingClientRect();
        const dx = x - rect.left;
        const dy = y - rect.top;
        const w = rect.width;
        const h = rect.height;

        this._mouse.x = (dx / w) * 2 - 1;
        this._mouse.y = -(dy / h) * 2 + 1;

        this._dollyDirection
            .set(this._mouse.x, this._mouse.y, 1)
            .unproject(this.object)
            .sub(this.object.position)
            .normalize();
    }

    _clampDistance(dist) {
        return Math.max(this.minDistance, Math.min(this.maxDistance, dist));
    }

    //
    // event callbacks - update the object state
    //

    _handleMouseDownRotate(event) {
        this._rotateStart.set(event.clientX, event.clientY);
    }

    _handleMouseDownDolly(event) {
        this._updateZoomParameters(event.clientX, event.clientX);
        this._dollyStart.set(event.clientX, event.clientY);
    }

    _handleMouseDownPan(event) {
        this._panStart.set(event.clientX, event.clientY);
    }

    _handleMouseMoveRotate(event) {
        this._rotateEnd.set(event.clientX, event.clientY);

        this._rotateDelta.subVectors(this._rotateEnd, this._rotateStart).multiplyScalar(this.rotateSpeed);

        const element = this.domElement;

        this._rotateLeft((_twoPI * this._rotateDelta.x) / element.clientHeight); // yes, height

        this._rotateUp((_twoPI * this._rotateDelta.y) / element.clientHeight);

        this._rotateStart.copy(this._rotateEnd);

        this.update();
    }

    _handleMouseMoveDolly(event) {
        this._dollyEnd.set(event.clientX, event.clientY);

        this._dollyDelta.subVectors(this._dollyEnd, this._dollyStart);

        if (this._dollyDelta.y > 0) {
            this._dollyOut(this._getZoomScale(this._dollyDelta.y));
        } else if (this._dollyDelta.y < 0) {
            this._dollyIn(this._getZoomScale(this._dollyDelta.y));
        }

        this._dollyStart.copy(this._dollyEnd);

        this.update();
    }

    _handleMouseMovePan(event) {
        this._panEnd.set(event.clientX, event.clientY);

        this._panDelta.subVectors(this._panEnd, this._panStart).multiplyScalar(this.panSpeed);

        this._pan(this._panDelta.x, this._panDelta.y);

        this._panStart.copy(this._panEnd);

        this.update();
    }

    _handleMouseWheel(event) {
        this._updateZoomParameters(event.clientX, event.clientY);

        if (event.deltaY < 0) {
            this._dollyIn(this._getZoomScale(event.deltaY));
        } else if (event.deltaY > 0) {
            this._dollyOut(this._getZoomScale(event.deltaY));
        }

        this.update();
    }

    _handleKeyDown(event) {
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

    _handleTouchStartRotate(event) {
        if (this._pointers.length === 1) {
            this._rotateStart.set(event.pageX, event.pageY);
        } else {
            const position = this._getSecondPointerPosition(event);

            const x = 0.5 * (event.pageX + position.x);
            const y = 0.5 * (event.pageY + position.y);

            this._rotateStart.set(x, y);
        }
    }

    _handleTouchStartPan(event) {
        if (this._pointers.length === 1) {
            this._panStart.set(event.pageX, event.pageY);
        } else {
            const position = this._getSecondPointerPosition(event);

            const x = 0.5 * (event.pageX + position.x);
            const y = 0.5 * (event.pageY + position.y);

            this._panStart.set(x, y);
        }
    }

    _handleTouchStartDolly(event) {
        const position = this._getSecondPointerPosition(event);

        const dx = event.pageX - position.x;
        const dy = event.pageY - position.y;

        const distance = Math.sqrt(dx * dx + dy * dy);

        this._dollyStart.set(0, distance);
    }

    _handleTouchStartDollyPan(event) {
        if (this.enableZoom) this._handleTouchStartDolly(event);

        if (this.enablePan) this._handleTouchStartPan(event);
    }

    _handleTouchStartDollyRotate(event) {
        if (this.enableZoom) this._handleTouchStartDolly(event);

        if (this.enableRotate) this._handleTouchStartRotate(event);
    }

    _handleTouchMoveRotate(event) {
        if (this._pointers.length == 1) {
            this._rotateEnd.set(event.pageX, event.pageY);
        } else {
            const position = this._getSecondPointerPosition(event);

            const x = 0.5 * (event.pageX + position.x);
            const y = 0.5 * (event.pageY + position.y);

            this._rotateEnd.set(x, y);
        }

        this._rotateDelta.subVectors(this._rotateEnd, this._rotateStart).multiplyScalar(this.rotateSpeed);

        const element = this.domElement;

        this._rotateLeft((_twoPI * this._rotateDelta.x) / element.clientHeight); // yes, height

        this._rotateUp((_twoPI * this._rotateDelta.y) / element.clientHeight);

        this._rotateStart.copy(this._rotateEnd);
    }

    _handleTouchMovePan(event) {
        if (this._pointers.length === 1) {
            this._panEnd.set(event.pageX, event.pageY);
        } else {
            const position = this._getSecondPointerPosition(event);

            const x = 0.5 * (event.pageX + position.x);
            const y = 0.5 * (event.pageY + position.y);

            this._panEnd.set(x, y);
        }

        this._panDelta.subVectors(this._panEnd, this._panStart).multiplyScalar(this.panSpeed);

        this._pan(this._panDelta.x, this._panDelta.y);

        this._panStart.copy(this._panEnd);
    }

    _handleTouchMoveDolly(event) {
        const position = this._getSecondPointerPosition(event);

        const dx = event.pageX - position.x;
        const dy = event.pageY - position.y;

        const distance = Math.sqrt(dx * dx + dy * dy);

        this._dollyEnd.set(0, distance);

        this._dollyDelta.set(0, Math.pow(this._dollyEnd.y / this._dollyStart.y, this.zoomSpeed));

        this._dollyOut(this._dollyDelta.y);

        this._dollyStart.copy(this._dollyEnd);

        const centerX = (event.pageX + position.x) * 0.5;
        const centerY = (event.pageY + position.y) * 0.5;

        this._updateZoomParameters(centerX, centerY);
    }

    _handleTouchMoveDollyPan(event) {
        if (this.enableZoom) this._handleTouchMoveDolly(event);

        if (this.enablePan) this._handleTouchMovePan(event);
    }

    _handleTouchMoveDollyRotate(event) {
        if (this.enableZoom) this._handleTouchMoveDolly(event);

        if (this.enableRotate) this._handleTouchMoveRotate(event);
    }

    // pointers

    _addPointer(event: PointerEvent) {
        this._pointers.push(event.pointerId);
    }

    _removePointer(event) {
        delete this._pointerPositions[event.pointerId];

        for (let i = 0; i < this._pointers.length; i++) {
            if (this._pointers[i] == event.pointerId) {
                this._pointers.splice(i, 1);
                return;
            }
        }
    }

    _isTrackingPointer(event: PointerEvent) {
        for (let i = 0; i < this._pointers.length; i++) {
            if (this._pointers[i] == event.pointerId) return true;
        }

        return false;
    }

    _trackPointer(event) {
        let position = this._pointerPositions[event.pointerId];

        if (position === undefined) {
            position = new Vector2();
            this._pointerPositions[event.pointerId] = position;
        }

        position.set(event.pageX, event.pageY);
    }

    _getSecondPointerPosition(event) {
        const pointerId = event.pointerId === this._pointers[0] ? this._pointers[1] : this._pointers[0];

        return this._pointerPositions[pointerId];
    }

    //

    _customWheelEvent(event) {
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
}

function onPointerDown(event) {
    if (this.enabled === false) return;

    if (this._pointers.length === 0) {
        this.domElement.setPointerCapture(event.pointerId);

        this.domElement.addEventListener("pointermove", this._onPointerMove);
        this.domElement.addEventListener("pointerup", this._onPointerUp);
    }

    //

    if (this._isTrackingPointer(event)) return;

    //

    this._addPointer(event);

    if (event.pointerType === "touch") {
        this._onTouchStart(event);
    } else {
        this._onMouseDown(event);
    }
}

function onPointerMove(event) {
    if (this.enabled === false) return;

    if (event.pointerType === "touch") {
        this._onTouchMove(event);
    } else {
        this._onMouseMove(event);
    }
}

function onPointerUp(event) {
    this._removePointer(event);

    switch (this._pointers.length) {
        case 0:
            this.domElement.releasePointerCapture(event.pointerId);

            this.domElement.removeEventListener("pointermove", this._onPointerMove);
            this.domElement.removeEventListener("pointerup", this._onPointerUp);

            this.dispatchEvent(_endEvent);

            this.state = STATE.NONE;

            break;

        case 1:
            const pointerId = this._pointers[0];
            const position = this._pointerPositions[pointerId];

            // minimal placeholder event - allows state correction on pointer-up
            this._onTouchStart({ pointerId: pointerId, pageX: position.x, pageY: position.y });

            break;
    }
}

function onMouseDown(event) {
    let mouseAction;

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
            mouseAction = -1;
    }

    switch (mouseAction) {
        case MOUSE.DOLLY:
            if (this.enableZoom === false) return;

            this._handleMouseDownDolly(event);

            this.state = STATE.DOLLY;

            break;

        case MOUSE.ROTATE:
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
                if (this.enablePan === false) return;

                this._handleMouseDownPan(event);

                this.state = STATE.PAN;
            } else {
                if (this.enableRotate === false) return;

                this._handleMouseDownRotate(event);

                this.state = STATE.ROTATE;
            }

            break;

        case MOUSE.PAN:
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
                if (this.enableRotate === false) return;

                this._handleMouseDownRotate(event);

                this.state = STATE.ROTATE;
            } else {
                if (this.enablePan === false) return;

                this._handleMouseDownPan(event);

                this.state = STATE.PAN;
            }

            break;

        default:
            this.state = STATE.NONE;
    }

    if (this.state !== STATE.NONE) {
        this.dispatchEvent(_startEvent);
    }
}

function onMouseMove(event) {
    switch (this.state) {
        case STATE.ROTATE:
            if (this.enableRotate === false) return;

            this._handleMouseMoveRotate(event);

            break;

        case STATE.DOLLY:
            if (this.enableZoom === false) return;

            this._handleMouseMoveDolly(event);

            break;

        case STATE.PAN:
            if (this.enablePan === false) return;

            this._handleMouseMovePan(event);

            break;
    }
}

function onMouseWheel(event) {
    if (this.enabled === false || this.enableZoom === false || this.state !== STATE.NONE) return;

    event.preventDefault();

    this.dispatchEvent(_startEvent);

    this._handleMouseWheel(this._customWheelEvent(event));

    this.dispatchEvent(_endEvent);
}

function onKeyDown(event) {
    if (this.enabled === false || this.enablePan === false) return;

    this._handleKeyDown(event);
}

function onTouchStart(event) {
    this._trackPointer(event);

    switch (this._pointers.length) {
        case 1:
            switch (this.touches.ONE) {
                case TOUCH.ROTATE:
                    if (this.enableRotate === false) return;

                    this._handleTouchStartRotate(event);

                    this.state = STATE.TOUCH_ROTATE;

                    break;

                case TOUCH.PAN:
                    if (this.enablePan === false) return;

                    this._handleTouchStartPan(event);

                    this.state = STATE.TOUCH_PAN;

                    break;

                default:
                    this.state = STATE.NONE;
            }

            break;

        case 2:
            switch (this.touches.TWO) {
                case TOUCH.DOLLY_PAN:
                    if (this.enableZoom === false && this.enablePan === false) return;

                    this._handleTouchStartDollyPan(event);

                    this.state = STATE.TOUCH_DOLLY_PAN;

                    break;

                case TOUCH.DOLLY_ROTATE:
                    if (this.enableZoom === false && this.enableRotate === false) return;

                    this._handleTouchStartDollyRotate(event);

                    this.state = STATE.TOUCH_DOLLY_ROTATE;

                    break;

                default:
                    this.state = STATE.NONE;
            }

            break;

        default:
            this.state = STATE.NONE;
    }

    if (this.state !== STATE.NONE) {
        this.dispatchEvent(_startEvent);
    }
}

function onTouchMove(event) {
    this._trackPointer(event);

    switch (this.state) {
        case STATE.TOUCH_ROTATE:
            if (this.enableRotate === false) return;

            this._handleTouchMoveRotate(event);

            this.update();

            break;

        case STATE.TOUCH_PAN:
            if (this.enablePan === false) return;

            this._handleTouchMovePan(event);

            this.update();

            break;

        case STATE.TOUCH_DOLLY_PAN:
            if (this.enableZoom === false && this.enablePan === false) return;

            this._handleTouchMoveDollyPan(event);

            this.update();

            break;

        case STATE.TOUCH_DOLLY_ROTATE:
            if (this.enableZoom === false && this.enableRotate === false) return;

            this._handleTouchMoveDollyRotate(event);

            this.update();

            break;

        default:
            this.state = STATE.NONE;
    }
}

function onContextMenu(event) {
    if (this.enabled === false) return;

    event.preventDefault();
}

function interceptControlDown(event) {
    if (event.key === "Control") {
        this._controlActive = true;

        const document = this.domElement.getRootNode(); // offscreen canvas compatibility

        document.addEventListener("keyup", this._interceptControlUp, { passive: true, capture: true });
    }
}

function interceptControlUp(event) {
    if (event.key === "Control") {
        this._controlActive = false;

        const document = this.domElement.getRootNode(); // offscreen canvas compatibility

        document.removeEventListener("keyup", this._interceptControlUp, { passive: true, capture: true });
    }
}

export { OrbitControls };
