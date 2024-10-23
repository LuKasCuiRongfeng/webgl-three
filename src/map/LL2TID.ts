import { getGlobalBytesUtils } from "./core";

const phi: number = (1.0 + Math.sqrt(5.0)) / 2.0;
const du: number = 1.0 / Math.sqrt(phi * phi + 1.0);
const dv: number = phi * du;

export class LL2TID {
    static CornerTop = 3200000;
    private static phi: number = (1.0 + Math.sqrt(5.0)) / 2.0;
    private static du: number = 1.0 / Math.sqrt(LL2TID.phi * LL2TID.phi + 1.0);
    private static dv: number = LL2TID.phi * LL2TID.du;

    private static pverts: number[][] = [
        [0, +dv, +du],
        [0, +dv, -du],
        [+dv, +du, 0],
        [0, +dv, +du],
        [+du, 0, +dv],
        [-du, 0, +dv],
        [0, +dv, +du],
        [-du, 0, +dv],
        [-dv, +du, 0],
        [0, +dv, +du],
        [+dv, +du, 0],
        [+du, 0, +dv],
        [0, +dv, +du],
        [-dv, +du, 0],
        [0, +dv, -du],
        [0, +dv, -du],
        [+du, 0, -dv],
        [+dv, +du, 0],
        [0, +dv, -du],
        [-du, 0, -dv],
        [+du, 0, -dv],
        [0, +dv, -du],
        [-dv, +du, 0],
        [-du, 0, -dv],
        [0, -dv, +du],
        [0, -dv, -du],
        [-dv, -du, 0],
        [0, -dv, +du],
        [+du, 0, +dv],
        [+dv, -du, 0],
        [0, -dv, +du],
        [-du, 0, +dv],
        [+du, 0, +dv],
        [0, -dv, +du],
        [+dv, -du, 0],
        [0, -dv, -du],
        [0, -dv, +du],
        [-dv, -du, 0],
        [-du, 0, +dv],
        [0, -dv, -du],
        [+du, 0, -dv],
        [-du, 0, -dv],
        [0, -dv, -du],
        [-du, 0, -dv],
        [-dv, -du, 0],
        [0, -dv, -du],
        [+dv, -du, 0],
        [+du, 0, -dv],
        [+du, 0, +dv],
        [+dv, +du, 0],
        [+dv, -du, 0],
        [-du, 0, +dv],
        [-dv, -du, 0],
        [-dv, +du, 0],
        [+du, 0, -dv],
        [+dv, -du, 0],
        [+dv, +du, 0],
        [-du, 0, -dv],
        [-dv, +du, 0],
        [-dv, -du, 0],
    ];

    private static LLtPos(longitude: number, latitude: number): { x: number; y: number; z: number } {
        longitude = Math.floor(longitude * 10000.0) / 10000.0 + 0.0001;
        latitude = Math.floor(latitude * 10000.0) / 10000.0 + 0.0001;

        const x: number = Math.sin(((latitude + 90.0) * Math.PI) / 180.0) * Math.cos((longitude * Math.PI) / 180.0);
        const y: number = -Math.cos(((latitude + 90.0) * Math.PI) / 180.0);
        const z: number = -Math.sin(((latitude + 90.0) * Math.PI) / 180.0) * Math.sin((longitude * Math.PI) / 180.0);

        return { x: x * 1000.0, y: y * 1000.0, z: z * 1000.0 };
    }

    private static Cross(A: number[], B: number[]): number[] {
        return [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
    }

    private static Dot(A: number[], B: number[]): number {
        return A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
    }

    private static Length(A: number[]): number {
        return Math.sqrt(A[0] * A[0] + A[1] * A[1] + A[2] * A[2]);
    }

    private static Normalize(A: number[]): number[] {
        const len: number = LL2TID.Length(A);
        return [A[0] / len, A[1] / len, A[2] / len];
    }

    private static IntersectBranchless(
        A: number[],
        B: number[],
        C: number[],
        TestPos: number[],
        trs = 0.001
    ): { rt: boolean; tbg: number[]; n: number[] } {
        const e0: number[] = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
        const e1: number[] = [A[0] - C[0], A[1] - C[1], A[2] - C[2]];
        const n: number[] = LL2TID.Cross(e1, e0);

        const dt: number = 1.0 / LL2TID.Dot(n, TestPos);
        const e2: number[] = [A[0] * dt, A[1] * dt, A[2] * dt];
        const i: number[] = LL2TID.Cross(TestPos, e2);

        const beta: number = LL2TID.Dot(i, e1);
        const gamma: number = LL2TID.Dot(i, e0);
        const t: number = LL2TID.Dot(n, e2);

        const rt: boolean =
            t * t < LL2TID.Length(TestPos) && t > 0.0 && beta >= -trs && gamma >= -trs && beta + gamma <= 1 + trs * 2;

        const tbg: number[] = [t, beta, gamma];
        return { rt, tbg, n };
    }

    private static SamplePointInTriangle(
        P1: number[],
        P2: number[],
        P3: number[],
        beta: number,
        gamma: number
    ): number[] {
        return [
            P2[0] * beta + P3[0] * gamma + P1[0] * (1.0 - beta - gamma),
            P2[1] * beta + P3[1] * gamma + P1[1] * (1.0 - beta - gamma),
            P2[2] * beta + P3[2] * gamma + P1[2] * (1.0 - beta - gamma),
        ];
    }

    private static GetCornerID(x: number, y: number, z: number): { id: number; bary: number[] } {
        const bary: number[] = [];
        const cornerCount: number = LL2TID.CornerTop;

        let aid = 0;
        let A: number[] = [];
        let B: number[] = [];
        let C: number[] = [];
        let TBG: number[] = [];

        for (let i = 0; i < 20; i++) {
            const a = LL2TID.pverts[i * 3];
            const b = LL2TID.pverts[i * 3 + 1];
            const c = LL2TID.pverts[i * 3 + 2];

            // const tbg: number[] = [];≈
            const { rt, tbg, n } = LL2TID.IntersectBranchless(a, b, c, LL2TID.Normalize([x, y, z]), 0);
            if (rt) {
                aid = i;
                A = a;
                B = b;
                C = c;
                TBG = tbg;
                break;
            }
        }

        const uvw: number[] = LL2TID.SamplePointInTriangle([0, 0, 0], [0, 1, 1], [1, 0, 1], TBG[1], TBG[2]);

        const areaSize: number = cornerCount / 20;
        const splitCount: number = Math.round(Math.sqrt(areaSize));

        const halfSize: number = ((splitCount + 1) * splitCount) / 2;

        const idf: number[] = [uvw[0] * splitCount, uvw[1] * splitCount, uvw[2] * splitCount];
        const id3: number[] = [Math.floor(idf[0]), Math.floor(idf[1]), Math.floor(idf[2])];

        const inBigID: number = (id3[0] + id3[1] + id3[2]) % 2;

        let baryResult: number[];
        if (inBigID === 1) {
            baryResult = [idf[0] - id3[0], idf[2] - id3[2], idf[1] - id3[1]];
            baryResult[0] = 1 - baryResult[0];
            baryResult[2] = 1 - baryResult[2];
        } else {
            baryResult = [idf[2] - id3[2], idf[1] - id3[1], idf[0] - id3[0]];
            baryResult[0] = 1 - baryResult[0];
        }

        baryResult[0] = Math.min(1, Math.max(0, baryResult[0]));
        baryResult[1] = Math.min(1, Math.max(0, baryResult[1]));
        baryResult[2] = Math.min(1, Math.max(0, baryResult[2]));

        const idS: number = Math.round(((splitCount - inBigID + (splitCount - inBigID - (id3[0] - 1))) * id3[0]) / 2.0);

        const id: number = aid * areaSize + (idS + id3[1] + inBigID * halfSize);

        return { id, bary: baryResult };
    }

    private static ToTileID(tileIDs: number[], bary: number[]): number {
        const disA: number = 1.0 - bary[0];
        const disB: number = 1.0 - bary[1];
        const disC: number = 1.0 - bary[2];

        if (disA < disB && disA < disC) {
            return tileIDs[0];
        } else if (disB < disC && disB < disA) {
            return tileIDs[1];
        } else {
            return tileIDs[2];
        }
    }

    // ... (other methods)

    public static LLConvertPos(longitude: number, latitude: number): number {
        const { x, y, z } = LL2TID.LLtPos(longitude, latitude);
        // console.log({ x, y, z });

        const { id, bary } = LL2TID.GetCornerID(x, y, z);
        const cornerByIndex = getGlobalBytesUtils().meshBytesUtils.getCornerByIndex(id);

        // console.log(cornerByIndex.tiles);
        const tileID: number = LL2TID.ToTileID(cornerByIndex.tiles, bary);
        //
        // console.log(`Longitude: ${longitude}, Latitude: ${latitude}`);
        // console.log(`World Coordinates (x, y, z): (${x}, ${y}, ${z})`);
        // console.log(`Corner ID: ${id}, Barycentric Coordinates (bary): [${bary.join(", ")}]`);
        // console.log(`Tile ID: ${tileID}`);
        return tileID;
    }
}
