import { useEffect, useRef, useState } from "react";
import { appendCanvas, cancelRender, getMapInitStatus, initMap, setEditType } from "../core";
import { MapInitStatus } from "../types";
import { sleep } from "../utils";
import "./index.less";
import { MOUSE_MODE } from "../consts";
import { setStatus } from "../elevation";

export default function Map() {
    const [initStatus, setInitStatus] = useState<MapInitStatus>({ checking: true, loadPercent: 0 });
    const containerRef = useRef<HTMLDivElement>();

    const loadMapAndData = async () => {
        const status = getMapInitStatus();
        setInitStatus({ ...status });
        if (status.error) return;

        initMap();
        await getInitStatus();
    };

    const getInitStatus = async () => {
        const status = getMapInitStatus();
        setInitStatus({ ...status });

        if (status.checking || status.loadPercent < 100) {
            await sleep(100);
            getInitStatus();
        }
    };

    useEffect(() => {
        loadMapAndData();

        return () => {
            cancelRender();
        };
    }, []);

    useEffect(() => {
        if (initStatus.loadPercent === 100) {
            appendCanvas(containerRef.current);
        }
    }, [initStatus]);

    return (
        <div className="container" ref={containerRef}>
            <progress
                max={100}
                value={initStatus.loadPercent || 0}
                style={{ display: initStatus.loadPercent === 100 ? "none" : "block" }}
            />

            <div className="container-test">
                <button onClick={() => setEditType(MOUSE_MODE.Mountain)}>山脉</button>
                <div>
                    <button onClick={() => setEditType(MOUSE_MODE.Elevation)}>海拔</button>
                    半径:{" "}
                    <input
                        type="range"
                        min={1}
                        max={10}
                        defaultValue={1}
                        onChange={(e) => setStatus("radius", Number(e.target.value) || 1)}
                    />
                    海拔:{" "}
                    <input
                        type="number"
                        min={1}
                        max={20}
                        defaultValue={1}
                        onChange={(e) => setStatus("value", Number(e.target.value) || 1)}
                    />
                </div>
                <button onClick={() => setEditType(MOUSE_MODE.Vegetation)}>植被</button>
            </div>
        </div>
    );
}
