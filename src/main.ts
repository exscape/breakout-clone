import { Game } from './Game';
import { Settings } from './Settings';

let canvasElement: HTMLCanvasElement | null = document.getElementById('canvas') as HTMLCanvasElement;
let context: CanvasRenderingContext2D | null = canvasElement?.getContext('2d');

let game: Game | undefined;

window.addEventListener('DOMContentLoaded', () => {
    if (!canvasElement || !context) {
        alert("Unable to load game!");
        return;
    }

    document.addEventListener('pointerlockchange', pointerLockChange, false);

    let settings: Settings = {
        canvasWidth: 1264,
        canvasHeight: 720,
        canvasMargin: 15,
        ballRadius: 13,
        paddleThickness: 25,
        ballSpeed: 0.75,
        brickWidth: 86,
        brickHeight: 25
    }

    canvasElement.width = settings.canvasWidth;
    canvasElement.height = settings.canvasHeight;

    game = new Game(canvasElement, settings);
    canvasElement.onclick = () => {
        if (document.pointerLockElement !== canvasElement)
            canvasElement!!.requestPointerLock();
        else
            game?.click();
    }

    canvasElement.onkeydown = (ev: KeyboardEvent) => {
        game?.keyDown(ev);
    }

    canvasElement.onkeyup = (ev: KeyboardEvent) => {
        game?.keyUp(ev);
    }

    canvasElement.tabIndex = 0
    canvasElement.focus();
});

let mouseMovedHandler = (e: MouseEvent) => { game?.mouseMoved(e) };
function pointerLockChange() {
    if (document.pointerLockElement === canvasElement)
        document.addEventListener("mousemove", mouseMovedHandler, false);
    else {
        document.removeEventListener("mousemove", mouseMovedHandler, false);
        game?.focusLost();
    }
}