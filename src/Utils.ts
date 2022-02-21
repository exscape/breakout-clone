import { Settings } from "./Settings";
import { Vec2 } from "./Vec2";

export function generatePairs(list: any[]): any[] {
    let pairs: any[] = [];
    if (list.length < 2) return []
    else {
        for (let i = 0; i < list.length; i++) {
            for (let j = i+1; j < list.length; j++) {
                pairs.push([list[i], list[j]]);
            }
        }

        return pairs;
    }
}

export function clamp(v: number, min: number, max: number) {
    if (v < min)
        v = min;
    else if (v > max)
        v = max;
    return v;
}

export function debugAlert(s: string) {
    if (true) {
        console.error("DEBUG ALERT: " + s);
        alert(s);
    }
}

export function formatTime(s: number) {
    // t is in seconds
    let h = Math.floor(s / 3600);
    s %= 3600;
    let m = Math.floor(s / 60);
    s %= 60;
    let ret = "";
    if (h > 0)
        ret += `${h.toString().padStart(2, "0")}:`;
    ret += `${m.toString().padStart(2, "0")}:`;
    ret += `${s.toString().padStart(2, "0")}`;

    return ret;
}

export function lerp(a: number, b: number, r: number) {
    return a + (b - a) * clamp(r, 0, 1);
}

// Convert from e.g. the brick at (4, 2) to the pixel coordinates (of the top-left corner)
export function drawCoordsFromBrickCoords(type: "x" | "y", coord: number, settings: Settings): number {
    const size = (type === "x") ? settings.brickWidth : settings.brickHeight;
    return settings.brickSpacing + coord * (size + (coord > 0 ? settings.brickSpacing : 0));
}

// Convert from a screen coordinate anywhere inside a brick to its brick coordinate
export function brickCoordsFromDrawCoords(type: "x" | "y", coord: number, settings: Settings): number {
    const size = (type === "x") ? settings.brickWidth : settings.brickHeight;
    const max = (type === "x") ? settings.levelWidth : settings.levelHeight;
    return clamp(Math.floor(coord / (size + settings.brickSpacing)), 0, max - 1);
}

export function clearBrickArray(array: any[][]) {
    for (let y = 0; y < array.length; y++) {
        for (let x = 0; x < array[0].length; x++) {
            array[y][x] = undefined;
        }
    }
}

export function copyBrickArray(src: any[][], dst: any[][], selectedOnly: boolean) {
    if (src.length !== dst.length || src[0].length !== dst[0].length)
        throw new Error("copy2DArray(): source and destination arrays have different dimensions");

    for (let y = 0; y < src.length; y++) {
        for (let x = 0; x < src[0].length; x++) {
            if (selectedOnly && !src[y][x]?.selected)
                dst[y][x] = undefined;
            dst[y][x] = (src[y][x] === undefined) ? undefined : src[y][x].copy();
        }
    }
}
