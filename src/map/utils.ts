import { IdModelMapBytesUtils, MapBytesUtils, MeshBytesUtils, ProvBytesUtils } from "./bytesUtils";
import ThreeManager from "./three-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { exists, readFile } from "@tauri-apps/plugin-fs";

/** 强行睡眠一段时间 */
export function sleep(time = 1000) {
    let timer: any = null;
    return new Promise((resolve) => {
        timer = setTimeout(() => {
            resolve(true);
            if (timer) {
                clearTimeout(timer);
            }
        }, time);
    });
}

type BytesUtils = {
    map: MapBytesUtils;
    mesh: MeshBytesUtils;
    mapProvs: ProvBytesUtils;
    idModelMap: IdModelMapBytesUtils;
};

/** 获取按字节读取 的地图或者网格对象 */
export async function getBytesUtils<T extends keyof BytesUtils>(type: T) {
    try {
        const selected = await open({
            multiple: false,
            filters: [{ name: type, extensions: ["bytes"] }],
        });
        if (!selected) return;

        const buffer = await readFileBytes(selected);
        if (!buffer) return;
        if (type === "map") {
            return new MapBytesUtils(buffer);
        }
        if (type === "mesh") {
            return new MeshBytesUtils(buffer);
        }
        if (type === "mapProvs") {
            return new ProvBytesUtils(buffer);
        }
        if (type === "idModelMap") {
            return new IdModelMapBytesUtils(buffer);
        }
    } catch (err: any) {
        return -1;
    }
}

async function readFileBytes(path: string) {
    const isExist = await exists(path);
    if (!isExist) return;

    const bytes = await readFile(path);
    return bytes.buffer;
}

export async function readFileBase64() {
    const path = await open({
        multiple: false,
        filters: [{ name: "选择纹理图片集", extensions: ["img", "png", "jpeg"] }],
    });
    if (!path) return;

    const isExist = await exists(path);
    if (!isExist) return;

    const bytes = await readFile(path);
    const nums = Array.from(bytes)
    const str = btoa(String.fromCharCode.apply(null, nums))

    return str
}
