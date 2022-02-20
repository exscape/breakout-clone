import { Brick } from "./Brick";
import { Game } from "./Game";
import { Settings } from "./Settings";
import { brickCoordsFromDrawCoords, clamp, drawCoordsFromBrickCoords } from "./Utils";
import { Vec2 } from "./Vec2";

export class Editor {
    game: Game;
    settings: Settings;
    cursor: Vec2;
    emptyLevelText: string;
    brickPalette: string[] = ["_delete", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "_indestructible"];

    bricks: (Brick | undefined)[][] = [];

    activeBrick: string = "brick1";

    leftButtonDown: boolean = false;
    rightButtonDown: boolean = false;

    constructor(game: Game, settings: Settings) {
        this.game = game;
        this.settings = settings;
        this.cursor = new Vec2(this.settings.canvasWidth / 2, this.settings.canvasHeight / 2);
        this.emptyLevelText = (".".repeat(this.settings.levelWidth) + "\n").repeat(this.settings.levelHeight);

        this.clearLevel();
    }

    clearLevel() {
        this.bricks.length = 0;
        this.bricks = Array(this.settings.levelHeight).fill(undefined).map(_ => Array(this.settings.levelWidth).fill(undefined));
        this.game.loadLevel(this.emptyLevelText, this.bricks);
    }

    exportLevel(): string {
        // Generates a string containing the level text, ready to be sent to the server.
        let lines: string[] = [];
        for (let y = 0; y < this.settings.levelHeight; y++) {
            let line: string[] = [];
            for (let x = 0; x < this.settings.levelWidth; x++) {
                const name = (this.bricks[y][x] !== undefined) ? this.bricks[y][x]!.name.substring(5) : "empty";

                let n = parseInt(name, 10);

                if (this.bricks[y][x] === undefined)
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

    placeBrickAtCursor(rightClick: boolean = false) {
        const x = brickCoordsFromDrawCoords("x", this.cursor.x, this.settings);
        const y = brickCoordsFromDrawCoords("y", this.cursor.y, this.settings);
        const drawCoords = new Vec2(drawCoordsFromBrickCoords("x", x, this.settings), drawCoordsFromBrickCoords("y", y, this.settings));
        if (this.activeBrick === "brick_delete" || rightClick) // Also delete if user right-clicked
            this.bricks[y][x] = undefined;
        else
            this.bricks[y][x] = new Brick(drawCoords, this.activeBrick, this.settings, 10, 1, this.activeBrick?.includes("_indestructible"));
    }

    keyDown(ev: KeyboardEvent) {
        if (ev.ctrlKey && (ev.key == "x" || ev.key == "X")) {
            // TODO: add checks about modified data / ask about saving etc.
            ev.preventDefault();
            this.game.exitEditor();
        }
        else if (ev.ctrlKey && (ev.key == "s" || ev.key == "S")) {
            ev.preventDefault();
            console.log(this.exportLevel());
        }
    }
    keyUp(ev: KeyboardEvent) {}

    mouseMoved(e: MouseEvent) {
        this.cursor.x = clamp(this.cursor.x + e.movementX, 0, this.settings.canvasWidth - 3);
        this.cursor.y = clamp(this.cursor.y + e.movementY, 0, this.settings.canvasHeight - 1);

        if (this.leftButtonDown || this.rightButtonDown)
            this.placeBrickAtCursor(this.rightButtonDown);
    }

    onmouseup(e: MouseEvent) {
        if (e.button === 0)
            this.leftButtonDown = false;
        else if (e.button === 2)
            this.rightButtonDown = false;
    }

    onmousedown(e: MouseEvent) {
        if (e.button === 0)
            this.leftButtonDown = true;
        else if (e.button === 2)
            this.rightButtonDown = true;

        const index = brickCoordsFromDrawCoords("x", this.cursor.x, this.settings);
        if (this.cursor.y >= this.settings.paletteY && this.cursor.y < this.settings.paletteY + this.settings.brickHeight) {
            // Click is in the palette
            this.activeBrick = `brick${this.brickPalette[index]}`;
        }
        else {
            // Click is in the game area
            this.placeBrickAtCursor(e.button === 2);
        }
    }

    focusLost() {
        this.leftButtonDown = false;
        this.rightButtonDown = false;
    }
}
