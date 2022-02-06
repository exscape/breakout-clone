import { Paddle, Ball, Settings, Vec2 } from './models';

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

        let ball = new Ball(new Vec2(), new Vec2(), "black");
        this.balls.push(ball);
        this.paddle.setStuckBall(ball);

        this.lastRender = 0;
        window.requestAnimationFrame((dt) => this.gameLoop(dt));
    }

    mouseMoved(e: MouseEvent) {
        this.paddle.move(e.movementX, e.movementY);
    }

    click() {
        if (this.paddle.stuckBall)
            this.paddle.launch();
    }

    update(dt: number) {
        for (let ball of this.balls) {
            if (ball.stuck) {
                if (ball.velocity.x != 0 || ball.velocity.y != 0)
                    alert("BUG: velocity != 0 while ball is stuck!");
                continue;
            }

            ball.position.x += ball.velocity.x * dt;
            ball.position.y += ball.velocity.y * dt;

            const r = this.settings.ballRadius;

            if (ball.position.x <= r) {
                ball.position.x = r;
                ball.velocity.x = -ball.velocity.x;
            }
            else if (ball.position.x + r >= this.settings.canvasWidth) {
                ball.position.x = this.settings.canvasWidth - r;
                ball.velocity.x = -ball.velocity.x;
            }

            if (ball.position.y <= r) {
                ball.position.y = r;
                ball.velocity.y = -ball.velocity.y;
            }
            else if (ball.position.y + r >= this.settings.canvasHeight) {
                ball.position.y = this.settings.canvasHeight - r;
                ball.velocity.y = -ball.velocity.y;
            }

            // TODO: handle collisions between balls -- if multiball is ever added
        }
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
        this.ctx.clearRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);

        // Draw the paddle
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#5050d0";
        this.ctx.lineCap = "round";
        this.ctx.moveTo(this.paddle.position.x, this.paddle.position.y);
        this.ctx.lineTo(this.paddle.position.x + this.paddle.width, this.paddle.position.y);
        this.ctx.stroke();
        this.ctx.lineWidth = this.settings.paddleThickness;
        this.ctx.fill();

        // Draw the balls
        for (let ball of this.balls) {
            this.ctx.beginPath();
            this.ctx.fillStyle = ball.color;
            this.ctx.arc(ball.position.x, ball.position.y, this.settings.ballRadius, 0, 2*Math.PI);
            this.ctx.fill();
        }
    }
}