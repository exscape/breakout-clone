import { Game } from './Game';
import { InputManager } from './InputManager';
import { Settings } from './Settings';

let gameCanvasElement: HTMLCanvasElement | null = null;
let statusCanvasElement: HTMLCanvasElement | null = null;

let inputManager: InputManager | undefined;
let game: Game | undefined;

window.addEventListener('DOMContentLoaded', () => {
    gameCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement;
    statusCanvasElement = document.getElementById('statusbar-canvas') as HTMLCanvasElement;

    if (!gameCanvasElement || !statusCanvasElement) {
        alert("Unable to load game!");
        return;
    }

    document.addEventListener('pointerlockchange', pointerLockChange, false);

    let settings: Settings = {
        canvasWidth: 0,  // calculated below
        canvasHeight: 0, // calculated below
        statusbarHeight: 44,
        editorToolbarWidth: 48,
        ballRadius: 13,
        paddleThickness: 25,
        ballSpeed: 0.64,
        brickWidth: 86,
        brickHeight: 25,
        brickSpacing: 4,
        levelWidth: 15, // in # of bricks
        levelHeight: 24, // in # of bricks; note that the last brick line is always empty, so in practice, this is an ODD height, not even
        canvasBackground: "#f7faff", //#ecf2ff" // "#ddedff" // #eaeaea
        powerupProbability: 6,//      * 2.5, // dev bonus
        powerupImageRadius: 18,
        powerupFallSpeed: 0.1,
        multiballSpawnInterval: 1000,
        aimLineLength: 150,
        paletteY: 0 // calculated below
    }

    // NOTE: canvasWidth EXCLUDES the width of the editor toolbar. canvasWidth matches the width of the <canvas> in the game, but not in the editor.
    settings.canvasWidth = settings.levelWidth * settings.brickWidth + settings.brickSpacing * (settings.levelWidth + 1);
    settings.canvasHeight = (settings.levelHeight + 1) * settings.brickHeight + settings.brickSpacing * (settings.levelHeight + 2);
    settings.paletteY = settings.canvasHeight - settings.brickHeight - settings.brickSpacing;

    gameCanvasElement.width = settings.canvasWidth;
    gameCanvasElement.height = settings.canvasHeight;

    statusCanvasElement.width = settings.canvasWidth;
    statusCanvasElement.height = settings.statusbarHeight;

    gameCanvasElement.style.visibility = "visible";
    statusCanvasElement.style.visibility = "visible";

    let onmousedownhandler = (e: MouseEvent) => {
        if (document.pointerLockElement === gameCanvasElement)
            inputManager?.onmousedown(e);
    };

    let onmouseuphandler = (e: MouseEvent) => {
        if (document.pointerLockElement !== gameCanvasElement) {
            gameCanvasElement!!.tabIndex = 0;
            gameCanvasElement!!.focus();
            gameCanvasElement!!.requestPointerLock();
        }
        else
            inputManager?.onmouseup(e);
    };

    inputManager = InputManager.getInstance();
    game = new Game(gameCanvasElement!!, statusCanvasElement, settings);
    inputManager.setSettings(settings);
    inputManager.setMaxWidth(settings.canvasWidth);
    inputManager.setMaxHeight(settings.canvasHeight);

    gameCanvasElement.onmousedown = onmousedownhandler;
    gameCanvasElement.onmouseup = onmouseuphandler;

    gameCanvasElement.onkeydown = (ev: KeyboardEvent) => {
        inputManager?.keyDown(ev);
    }

    gameCanvasElement.onkeyup = (ev: KeyboardEvent) => {
        inputManager?.keyUp(ev);
    }

    gameCanvasElement.tabIndex = 0
    gameCanvasElement.focus();
});

let mouseMovedHandler = (e: MouseEvent) => {
    inputManager?.mouseMoved(e)
};

function pointerLockChange() {
    if (document.pointerLockElement === gameCanvasElement)
        document.addEventListener("mousemove", mouseMovedHandler, false);
    else {
        document.removeEventListener("mousemove", mouseMovedHandler, false);
        inputManager?.focusLost();
    }
}
