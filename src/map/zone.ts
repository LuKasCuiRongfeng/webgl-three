import { GeoBounds, ZoneData } from "./types";
import ThreeManager, { Box3, Frustum, Vector3 } from "./three-manager";

export class QuadTreeNode {
    bounds: GeoBounds;
    level: number;
    maxLevel: number;
    children: QuadTreeNode[];
    zones: ZoneData[] = [];
    manager: ThreeManager;
    radius: number;

    constructor(bounds: GeoBounds, manager: ThreeManager, radius: number, level = 0, maxLevel = 4) {
        this.bounds = bounds;
        this.level = level;
        this.maxLevel = maxLevel;
        this.manager = manager;
        // 往外草一点
        this.radius = radius;

        // 判断是否需要继续分割节点
        if (level < maxLevel) {
            this.subdivide();
        }
    }

    subdivide() {
        const { lonMin, lonMax, latMin, latMax } = this.bounds;
        const lonMid = (lonMin + lonMax) / 2;
        const latMid = (latMin + latMax) / 2;

        // 分成四个节点
        this.children = [
            // 左上
            new QuadTreeNode(
                {
                    lonMin: lonMin,
                    lonMax: lonMid,
                    latMin: latMid,
                    latMax: latMax,
                },
                this.manager,
                this.radius,
                this.level + 1,
                this.maxLevel
            ),
            // 右上
            new QuadTreeNode(
                {
                    lonMin: lonMid,
                    lonMax: lonMax,
                    latMin: latMid,
                    latMax: latMax,
                },
                this.manager,
                this.radius,
                this.level + 1,
                this.maxLevel
            ),
            // 左下
            new QuadTreeNode(
                {
                    lonMin: lonMin,
                    lonMax: lonMid,
                    latMin: latMin,
                    latMax: latMid,
                },
                this.manager,
                this.radius,
                this.level + 1,
                this.maxLevel
            ),
            // 右下
            new QuadTreeNode(
                {
                    lonMin: lonMid,
                    lonMax: lonMax,
                    latMin: latMin,
                    latMax: latMid,
                },
                this.manager,
                this.radius,
                this.level + 1,
                this.maxLevel
            ),
        ];
    }

    /** 插入分区到节点 */
    insert(zone: ZoneData) {
        if (!this.children) {
            // 叶子节点，直接存储
            this.zones.push(zone);
            return;
        }

        // 非叶子节点
        for (const child of this.children) {
            if (this.zoneInBound(zone.bounds, child.bounds)) {
                // 递归过程，直至插入到叶子节点
                child.insert(zone);
            }
        }
    }

    zoneInBound(zoneBounds: GeoBounds, nodeBounds: GeoBounds) {
        const { lonMin, lonMax, latMin, latMax } = nodeBounds;
        const { center } = zoneBounds;

        return (
            center.lng >= lonMin &&
            center.lng < lonMax &&
            center.lat >= latMin &&
            center.lat < latMax
        );
    }

    // 查询视锥体内有哪些可见的分区
    query(frustum: Frustum) {
        const zones: ZoneData[] = [];

        // 整个节点都不在视锥内部，直接返回
        if (!this.isNodeVisible(frustum)) {
            return zones;
        }

        // 叶子节点
        if (!this.children) {
            return this.zones;
        }

        // 递归查询子节点
        for (const child of this.children) {
            zones.push(...child.query(frustum));
        }

        return zones;
    }

    // 判断当前节点是否视锥体内可见
    isNodeVisible(frustum: Frustum) {
        const boudingBox = this.getBoundingBox();
        return frustum.intersectsBox(boudingBox);
    }

    getBoundingBox() {
        const { lonMin, lonMax, latMin, latMax } = this.bounds;
        const box = new Box3();

        // 考虑再增加点，准确度高点
        // const latC = (latMax + latMin) / 2;
        // const lonC = (lonMax + lonMin) / 2;

        // // 左中上
        // const a = this.manager.latLngToVector3(
        //     (latMax + latC) / 2,
        //     (lonMin + lonC) / 2,
        //     this.radius
        // );

        // // 左中下
        // const b = this.manager.latLngToVector3(
        //     (latMin + latC) / 2,
        //     (lonMin + lonC) / 2,
        //     this.radius
        // );

        // // 右中上
        // const c = this.manager.latLngToVector3(
        //     (latMax + latC) / 2,
        //     (lonMax + lonC) / 2,
        //     this.radius
        // );

        // // 左中上
        // const d = this.manager.latLngToVector3(
        //     (latMin + latC) / 2,
        //     (lonMax + lonC) / 2,
        //     this.radius
        // );

        // 左上
        const lt = this.manager.latLngToVector3(latMax, lonMin, this.radius);
        // 左下
        const lb = this.manager.latLngToVector3(latMin, lonMin, this.radius);
        // 右上
        const rt = this.manager.latLngToVector3(latMax, lonMax, this.radius);
        // 右下
        const rb = this.manager.latLngToVector3(latMin, lonMax, this.radius);

        // 加上中点检查更准确
        const center = this.manager.latLngToVector3(
            (latMax + latMin) / 2,
            (lonMax + lonMin) / 2,
            this.radius
        );

        // 计算包围盒的8个顶点
        const corners = [lt, lb, rt, rb, center];
        // const corners = [lt, lb, rt, rb, center, a, b, c, d];

        // 扩展包围盒包含所有顶点
        corners.forEach((corner) => box.expandByPoint(corner));
        // box.setFromPoints(corners)
        return box;
    }
}
