import { useEffect, useRef, useState } from "react";
import { appendCanvas, cancelRender, getMapInitStatus, initMap } from "../core";
import { MapInitStatus } from "../types";
import { sleep } from "../utils";
import "./index.less"

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

    return <div className="container" ref={containerRef}>
        <progress max={100} value={initStatus.loadPercent || 0} style={{ display: initStatus.loadPercent === 100 ? "none" : "block" }} />
    </div>
}