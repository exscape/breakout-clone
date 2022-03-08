import { Brick, BrickOrEmpty } from "./Brick";
import { Settings } from "./Settings";
import { ConfirmationDialog } from "./UI/ConfirmationDialog";
import { LoadingScreen } from "./UI/LoadingScreen";
import { NotificationDialog } from "./UI/NotificationDialog";
import { BrickPosition, Vec2 } from "./Vec2";
import { WindowManager } from "./WindowManager";

export type LevelType = "campaign" | "standalone";
export type LevelMetadata = { level_id: number, name: string, type: LevelType, levelnumber: number, leveltext: string, author: string, author_id: number };
export type LevelIndexResult = { "campaign": LevelMetadata[], "standalone": LevelMetadata[] };
export type Mode = "game" | "editor";

export class Rect {
    left: number;
    right: number;
    top: number;
    bottom: number;

    width: number;
    height: number;
    horizontalCenter: number;
    verticalCenter: number;

    constructor(left: number, top: number, width: number, height: number) {
        this.left = left;
        this.top = top;
        this.right = left + width;
        this.bottom = top + height;
        this.width = width;
        this.height = height;
        this.horizontalCenter = left + width / 2;
        this.verticalCenter = top + height / 2;
    }

    isInsideRect(pos: Vec2): boolean {
        return pos.x >= this.left && pos.x < this.right &&
               pos.y >= this.top && pos.y < this.bottom;
    }

    intersectsWith(other: Rect): boolean {
        return this.left < other.right &&
               this.right > other.left &&
               this.top < other.bottom &&
               this.bottom > other.top;
    }
}

export abstract class UIElement {
    rect: Rect;

    constructor(rect: Rect) {
        this.rect = rect;
    }
}

export class UIHorizontalSeparator extends UIElement {
    constructor(rect: Rect) {
        super(rect);
    }
}

export class UIButton extends UIElement {
    image: string | null;
    clickCallback: (button: UIButton) => void;
    tooltip: string;
    enabled: boolean;
    hidden: boolean = false;
    drawBackground: boolean;
    shortcut: string | null = null;

    constructor(rect: Rect, image: string | null, text: string, shortcut: string | null, initiallyEnabled: boolean, drawBackground: boolean, clickCallback: (button: UIButton) => void) {
        super(rect);
        this.image = image;
        this.clickCallback = clickCallback;
        this.enabled = initiallyEnabled;
        this.drawBackground = drawBackground;
        this.tooltip = text;
        this.shortcut = shortcut;
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
export function drawCoordsFromBrickCoords(type: "x" | "y", coord: number, settings: Settings, offset: number = 0): number {
    const size = (type === "x") ? settings.brickWidth : settings.brickHeight;
    return offset + settings.brickSpacing + coord * (size + (coord > 0 ? settings.brickSpacing : 0));
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

export function fetchLevelIndex(levelType: "standalone" | "campaign", successCallback: (levels: LevelMetadata[]) => void, failureCallback: () => void) {
    fetch('/game/level_index.php', {
            method: "GET",
            cache: 'no-cache'
    })
    .then(response => response.json())
    .then(json => {
        if ("type" in json && json.type === "error") {
            alert("Failed to read level index: " + json.error);
            failureCallback();
        }
        else if (!("result" in json)) {
            alert("Invalid answer from server");
            failureCallback();
        }

        let result = json.result as LevelIndexResult;
        if (levelType === "standalone")
            successCallback(result.standalone);
        else if (levelType === "campaign")
            successCallback(result.campaign);

    })
    .catch(error => {
        alert("Failed to download level index: " + error);
        failureCallback();
    });
}

export function uploadLevel(level: LevelMetadata) {
    let formData = new FormData();
    if (level.level_id === 0) {
        formData.append("action", "add");
    }
    else {
        formData.append("action", "update");
        formData.append("id", level.level_id.toString());
    }
    formData.append("levelName", level.name);
    formData.append("levelText", level.leveltext);
    formData.append("type", "standalone");
    // formData.append("levelNumber", ...);

    return fetch('/game/level_upload.php', {
        method: "POST",
        cache: 'no-cache',
        body: formData
    })
    .then(response => response.json());
}

export function deleteLevel(level: LevelMetadata) {
    let formData = new FormData();
    formData.append("action", "delete");
    formData.append("id", level.level_id.toString());

    return fetch('/game/level_upload.php', {
        method: "POST",
        cache: 'no-cache',
        body: formData
    })
    .then(response => response.json());
}

export function loadBricksFromLevelText(levelText: string, target: BrickOrEmpty[][], settings: Settings): boolean {
    let level2D: string[][] = [];

    let count = 0;
    for (let row of levelText.split('\n')) {
        count++;
        if (count > settings.levelHeight)
            break;

        let chars = row.split('');
        if (chars.length !== settings.levelWidth) {
            alert(`Invalid level: one or more lines is not exactly ${settings.levelWidth} characters`);
            return false;
        }
        level2D.push(chars);
    }
    if (level2D.length !== settings.levelHeight) {
        alert(`Invalid level: not exactly ${settings.levelHeight} lines`);
        return false;
    }

    for (let y = 0; y < settings.levelHeight; y++) {
        for (let x = 0; x < settings.levelWidth; x++) {
            let xCoord = drawCoordsFromBrickCoords("x", x, settings);
            let yCoord = drawCoordsFromBrickCoords("y", y, settings);
            let c = level2D[y][x];
            let num = parseInt(c, 16);
            if (!isNaN(num)) {
                target[y][x] = new Brick(new Vec2(xCoord, yCoord), `brick${num}`, settings, 10, 1);
            }
            else if (c === '*') {
                target[y][x] = new Brick(new Vec2(xCoord, yCoord), `brick_indestructible`, settings, 10, 1, true);
            }
            else if (c === '.') {
                target[y][x] = undefined;
            }
        }
    }

    return true;
}

export function generateLevelTextFromBricks(bricks: BrickOrEmpty[][], settings: Settings): string {
    // Generates a string containing the level text, ready to be sent to the server.
    let lines: string[] = [];
    for (let y = 0; y < settings.levelHeight; y++) {
        let line: string[] = [];
        for (let x = 0; x < settings.levelWidth; x++) {
            const name = (bricks[y][x] !== undefined) ? bricks[y][x]!.name.substring(5) : "empty";

            let n = parseInt(name, 10);

            if (bricks[y][x] === undefined)
                line.push(".");
            else if ((n = parseInt(name, 10)) > 0)
                line.push(n.toString(16).toUpperCase());
            else if (name === "_indestructible")
                line.push("*");
            else
                alert("BUG: invalid brick type in exportLevel");
        }
        line.push("\n");
        lines.push(line.join(""));
    }

    return lines.join("");
}

export function generateEmptyBrickArray(settings: Settings): BrickOrEmpty[][] {
    return Array(settings.levelHeight).fill(undefined).map(_ => Array(settings.levelWidth).fill(undefined));
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    var words = text.split(" ");
    var lines = [];
    var currentLine = words[0];

    for (var i = 1; i < words.length; i++) {
        var word = words[i];
        var width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);

    return lines;
}

export function splitText(text: string): string[] {
    return text.split(/\r?\n/);
}

export function createConfirmationDialog(text: string, positiveText: string, negativeText: string, settings: Settings, positiveCallback: () => void, negativeCallback: () => void) {
    let confirmationDialog = new ConfirmationDialog(text, positiveText, negativeText, settings, positiveCallback, negativeCallback);
    WindowManager.getInstance().addWindow(confirmationDialog, true);
}

export function createLoadingScreen(text: string, settings: Settings) {
    let loadingScreen = new LoadingScreen(text, settings);
    WindowManager.getInstance().addWindow(loadingScreen, true);
}

function readCookieValue(name: string): number | undefined {
    let cookies = document.cookie.split(/; */);
    for (let cookie of cookies) {
        let [key, value] = cookie.split("=");
        if (key === name)
            return parseInt(value);
    }

    return undefined;
}

// Note: These cookies have no value security-wise; forging them can't give any access to the backend.
export function userId(): number | undefined {
    return readCookieValue("userinfo_id");
}

// Note: These cookies have no value security-wise; forging them can't give any access to the backend.
export function isAdmin(): boolean {
    return readCookieValue("userinfo_is_admin") === 1;
}

export function userMayModifyLevel(level: LevelMetadata): boolean {
    return (level.author_id === userId()) || isAdmin();
}

export function createNotificationDialog(text: string, settings: Settings, positiveText: string | null, timeout: number | null,
                                         positiveCallback: (() => void) | null, timeoutCallback: (() => void) | null): NotificationDialog {
    let dialog = new NotificationDialog(text, settings, positiveText, timeout, positiveCallback, timeoutCallback);
    WindowManager.getInstance().addWindow(dialog, positiveText !== null);

    return dialog;
}

export function notifyWithTimeout(text: string, timeout: number, settings: Settings) {
    return createNotificationDialog(text, settings, null, timeout, null, null);
}
