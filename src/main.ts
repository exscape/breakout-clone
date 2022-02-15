import { Game } from './Game';
import { Settings } from './Settings';

let gameCanvasElement: HTMLCanvasElement | null = null;
//let gameContext: CanvasRenderingContext2D | null = null;
let statusCanvasElement: HTMLCanvasElement | null = null;
//let statusContext: CanvasRenderingContext2D | null = null;

let game: Game | undefined;

window.addEventListener('DOMContentLoaded', () => {
    gameCanvasElement = document.getElementById('main-canvas') as HTMLCanvasElement;
    // gameContext = gameCanvasElement?.getContext('2d');

    statusCanvasElement = document.getElementById('statusbar-canvas') as HTMLCanvasElement;
    // statusContext = statusCanvasElement?.getContext('2d');

    if (!gameCanvasElement || !statusCanvasElement /*|| !gameContext || !statusContext */) {
        alert("Unable to load game!");
        return;
    }

    document.addEventListener('pointerlockchange', pointerLockChange, false);

    let settings: Settings = {
        canvasWidth: 1264,
        canvasHeight: 720,
        canvasMargin: 15,
        statusbarHeight: 56,
        ballRadius: 13,
        paddleThickness: 25,
        ballSpeed: 0.7,
        brickWidth: 86,
        brickHeight: 25,
        canvasBackground: "#f7faff", //#ecf2ff" // "#ddedff" // #eaeaea
        powerupProbability: 2,
        powerupImageRadius: 24,
        powerupFallSpeed: 0.1,
        multiballSpawnInterval: 1000,
        aimLineLength: 150
    }

    gameCanvasElement.width = settings.canvasWidth;
    gameCanvasElement.height = settings.canvasHeight;

    statusCanvasElement.width = settings.canvasWidth;
    statusCanvasElement.height = settings.statusbarHeight;

    gameCanvasElement.style.visibility = "visible";
    statusCanvasElement.style.visibility = "visible";

    let onclickHandler = () => {
        if (document.pointerLockElement !== gameCanvasElement) {
            gameCanvasElement!!.tabIndex = 0;
            gameCanvasElement!!.focus();
            gameCanvasElement!!.requestPointerLock();
        }
        else
            game?.click();
    };

    game = new Game(gameCanvasElement, statusCanvasElement, settings);

    gameCanvasElement.onclick = onclickHandler;
    statusCanvasElement.onclick = onclickHandler;

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