import { Brick } from "./Brick";
import { Game } from "./Game";
import { Settings } from "./Settings";
import { brickCoordsFromDrawCoords, clamp } from "./Utils";
import { Vec2 } from "./Vec2";

export class Editor {
    game: Game;
    settings: Settings;
    cursor: Vec2;
    emptyLevelText: string;
    brickPalette: string[] = ["_dashed", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12","_indestructible"];

    bricks: (Brick | undefined)[][] = [];

    activeBrick: string | null = "brick1";

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

    keyDown(ev: KeyboardEvent) {
        if (ev.ctrlKey && (ev.key == "x" || ev.key == "X")) {
            // TODO: add checks about modified data / ask about saving etc.
            this.game.exitEditor();
        }
    }
    keyUp(ev: KeyboardEvent) {}

    mouseMoved(e: MouseEvent) {
        this.cursor.x = clamp(this.cursor.x + e.movementX, 0, this.settings.canvasWidth - 3);
        this.cursor.y = clamp(this.cursor.y + e.movementY, 0, this.settings.canvasHeight - 1);
    }

    click() {
        if (this.cursor.y >= this.settings.paletteY && this.cursor.y < this.settings.paletteY + this.settings.brickHeight) {
            const brickX = brickCoordsFromDrawCoords("x", this.cursor.x, this.settings);
            this.activeBrick = `brick${this.brickPalette[brickX]}`;
        }
    }
}
