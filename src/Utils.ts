import { BrickOrEmpty } from "./Brick";
import { Settings } from "./Settings";
import { BrickPosition, Vec2 } from "./Vec2";

export class Rect {
    left: number;
    right: number;
    top: number;
    bottom: number;

    constructor(left: number, top: number, width: number, height: number) {
        this.left = left;
        this.top = top;
        this.right = left + width;
        this.bottom = top + height;
    }

    isInsideRect(pos: Vec2): boolean {
        return pos.x >= this.left && pos.x < this.right &&
               pos.y >= this.top && pos.y < this.bottom;
    }
}

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

export function copyBrickArray(src: BrickOrEmpty[][], dst: BrickOrEmpty[][], copySelected: boolean, copyUnselected: boolean, callback?: (b: BrickOrEmpty) => void) {
    if (src.length !== dst.length || src[0].length !== dst[0].length)
        throw new Error("copy2DArray(): source and destination arrays have different dimensions");

    for (let y = 0; y < src.length; y++) {
        for (let x = 0; x < src[0].length; x++) {
            if (copySelected && src[y][x]?.selected) {
                dst[y][x] = (src[y][x] === undefined) ? undefined : src[y][x]!.copy();
                dst[y][x]?.updateDrawPosition(x, y);
                if (callback)
                    callback(dst[y][x]);
            }
            if (copyUnselected && !src[y][x]?.selected) {
                dst[y][x] = (src[y][x] === undefined) ? undefined : src[y][x]!.copy();
                dst[y][x]?.updateDrawPosition(x, y);
                if (callback)
                    callback(dst[y][x]);
            }
        }
    }
}

function calculateOneSymmetricPosition(axis: "x" | "y", symmetryCenter: number, pos: BrickPosition, settings: Settings) {
    // Okay. symmetryCenter is a already-snapped *pixel* value, not a brick value.
    // It's positioned either on a brick edge OR at a brick center, separately, on the x and y axes.
    // First, calculate the brick position, allowing half values.
    // We use round, but this should produce exact values even without rounding to the nearest half, and in my testing did so.
    const brickSize = (axis === "x") ? settings.brickWidth : settings.brickHeight;
    const center = Math.round(2 * (symmetryCenter - settings.brickSpacing / 2) / (settings.brickSpacing + brickSize)) / 2;

    let newPos = new BrickPosition(pos);
    if (axis === "x")
        newPos.x = 2*center - pos.x - 1;
    else
        newPos.y = 2*center - pos.y - 1;

    return newPos;
}

// Note: This can return out-of-bounds block positions. Check each return with validBrickPosition()!
export function calculateSymmetricPositions(pos: BrickPosition, symmetryCenter: Vec2, horizontalSymmetry: boolean, verticalSymmetry: boolean, settings: Settings) {
    let result: BrickPosition[] = [new BrickPosition(pos)];

    let newPosH = pos; // Needs a value to silence the compiler, even though we know it's never used when undefined
    if (horizontalSymmetry) {
        newPosH = calculateOneSymmetricPosition("x", symmetryCenter.x, pos, settings);
        result.push(newPosH);
    }

    if (verticalSymmetry)
        result.push(calculateOneSymmetricPosition("y", symmetryCenter.y, pos, settings));

    if (horizontalSymmetry && verticalSymmetry)
        result.push(calculateOneSymmetricPosition("y", symmetryCenter.y, newPosH, settings));

    return result;
}

// Snap the symmetry center point from any (x,y) coordinate to one that is aligned with a brick center or edge
export function snapSymmetryCenter(cursor: Vec2, settings: Settings): Vec2 {
    let snapped = new Vec2(cursor);

    // This sure saved me a while of thinking/trial and error. :-)
    // https://stackoverflow.com/a/16338275/1668576
    let snapValue = (input: number, offset: number, multiple: number) => { return (Math.round((input - offset) / multiple) * multiple) + offset; }

    snapped.x = snapValue(cursor.x, settings.brickSpacing / 2, (settings.brickSpacing + settings.brickWidth) / 2);
    snapped.y = snapValue(cursor.y, settings.brickSpacing / 2, (settings.brickSpacing + settings.brickHeight) / 2);

    return snapped;
}

export function levelCenter(axis: "x" | "y", settings: Settings) {
    if (axis === "x")
        return settings.canvasWidth / 2;
    else
        return drawCoordsFromBrickCoords("y", Math.floor(settings.levelHeight / 2), settings) - (settings.brickHeight / 2) - settings.brickSpacing;
}

export function validBrickPosition(brick: BrickPosition, settings: Settings) {
    return (brick.x >= 0 && brick.x < settings.levelWidth &&
            brick.y >= 0 && brick.y < settings.levelHeight);

}
