let canvasElement: HTMLCanvasElement | null = document.getElementById('canvas') as HTMLCanvasElement;
let context: CanvasRenderingContext2D | null = canvasElement?.getContext('2d');

let posX = 100;
let posY = 100;

window.addEventListener('DOMContentLoaded', () => {
    if (!canvasElement || !context) {
        alert("Unable to load game!");
        return;
    }

    document.addEventListener('pointerlockchange', pointerLockChange, false);

    canvasElement.onclick = () => {
        canvasElement!!.requestPointerLock();
    }

    canvasElement.width = 1200;
    canvasElement.height = 720;

});

function pointerLockChange() {
    if (document.pointerLockElement === canvasElement)
        document.addEventListener("mousemove", mouseMoved, false);
    else
        document.removeEventListener("mousemove", mouseMoved, false);
}

function mouseMoved(e: MouseEvent) {
    console.log(e);

    posX += e.movementX;
    posY += e.movementY;
}

function update(dt: number) {

}

let lastRender = 0;
function gameLoop(timestamp: number) {
    var progress = timestamp - lastRender

    update(progress)
    drawFrame()

    lastRender = timestamp
    window.requestAnimationFrame(gameLoop)
}

function drawFrame() {
    if (!context || !canvasElement) return;
    let ctx = context as CanvasRenderingContext2D;
    let canvas = canvasElement as HTMLCanvasElement;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f00";
    ctx.beginPath();
    ctx.arc(posX, posY, 20, 0, 2*Math.PI, true);
    ctx.fill();
}

window.requestAnimationFrame(gameLoop)