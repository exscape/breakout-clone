import { Paddle, Ball, Settings } from './models';

export class Game {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    paddle: Paddle;
    balls: Ball[] = [];
    settings: Settings

    lastRender: number;

    constructor(canvas: HTMLCanvasElement, settings: Settings) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!!;
        this.paddle = new Paddle(settings);
        this.settings = settings;

        this.lastRender = 0;
        window.requestAnimationFrame((dt) => this.gameLoop(dt));
    }

    mouseMoved(e: MouseEvent) {
        this.paddle.move(e.movementX, e.movementY);
    }

    update(dt: number) {
    }

    gameLoop(timestamp: number) {
        var dt = timestamp - this.lastRender

        this.update(dt)
        this.drawFrame()

        this.lastRender = timestamp
        window.requestAnimationFrame((dt) => this.gameLoop(dt));
    }

    drawFrame() {
        // Clear the frame
        /*
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);
        */
        this.ctx.clearRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);

        // Draw the paddle
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#101010";
        this.ctx.fillStyle = "#4040f0";
        this.ctx.lineCap = "round";
        this.ctx.moveTo(this.paddle.x, this.paddle.y);
        this.ctx.lineTo(this.paddle.x + this.paddle.width, this.paddle.y);
        this.ctx.stroke();
        this.ctx.lineWidth = 25;
        this.ctx.fill();
    }
}