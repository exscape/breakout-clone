import { Game } from './Game';
import { Settings } from './Settings';

let gameCanvasElement: HTMLCanvasElement | null = null;
let statusCanvasElement: HTMLCanvasElement | null = null;

let game: Game | undefined;

window.addEventListener('DOMContentLoaded', () => {
    gameCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement;
    statusCanvasElement = document.getElementById('statusbar-canvas') as HTMLCanvasElement;

    if (!gameCanvasElement || !statusCanvasElement /*|| !gameContext || !statusContext */) {
        alert("Unable to load game!");
        return;
    }

    document.addEventListener('pointerlockchange', pointerLockChange, false);

    let settings: Settings = {
        canvasWidth: 0,  // calculated below
        canvasHeight: 0, // calculated below
        statusbarHeight: 44,
        ballRadius: 13,
        paddleThickness: 25,
        ballSpeed: 0.64,
        brickWidth: 86,
        brickHeight: 25,
        brickSpacing: 4,
        levelWidth: 15, // in # of bricks
        levelHeight: 23, // in # of bricks
        canvasBackground: "#f7faff", //#ecf2ff" // "#ddedff" // #eaeaea
        powerupProbability: 6,//      * 2.5, // dev bonus
        powerupImageRadius: 18,
        powerupFallSpeed: 0.1,
        multiballSpawnInterval: 1000,
        aimLineLength: 150,
        paletteY: 0 // calculated below
    }
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
            game?.onmousedown(e);
    };

    let onmouseuphandler = (e: MouseEvent) => {
        if (document.pointerLockElement !== gameCanvasElement) {
            gameCanvasElement!!.tabIndex = 0;
            gameCanvasElement!!.focus();
            gameCanvasElement!!.requestPointerLock();
        }
        else
            game?.onmouseup(e);
    };

    game = new Game(gameCanvasElement!!, statusCanvasElement, settings);

    gameCanvasElement.onmousedown = onmousedownhandler;
    gameCanvasElement.onmouseup = onmouseuphandler;

    gameCanvasElement.onkeydown = (ev: KeyboardEvent) => {
        game?.keyDown(ev);
    }

    gameCanvasElement.onkeyup = (ev: KeyboardEvent) => {
        game?.keyUp(ev);
    }

    gameCanvasElement.tabIndex = 0
    gameCanvasElement.focus();
});

let mouseMovedHandler = (e: MouseEvent) => { game?.mouseMoved(e) };
function pointerLockChange() {
    if (document.pointerLockElement === gameCanvasElement)
        document.addEventListener("mousemove", mouseMovedHandler, false);
    else {
        document.removeEventListener("mousemove", mouseMovedHandler, false);
        game?.focusLost();
    }
}
