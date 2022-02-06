import { Paddle, Ball, Settings, Vec2 } from './models';

export class Game {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    paddle: Paddle;
    balls: Ball[] = [];
    settings: Settings

    lastRender: number;
    gameLost: boolean = false;

    constructor(canvas: HTMLCanvasElement, settings: Settings) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!!;
        this.paddle = new Paddle(settings);
        this.settings = settings;

        this.reset();

        this.lastRender = 0;
        window.requestAnimationFrame((dt) => this.gameLoop(dt));
    }

    reset() {
        this.gameLost = false;
        this.balls.length = 0; // Why is there no clear method?!

        let ball = new Ball(new Vec2(), new Vec2(), "black");
        this.balls.push(ball);
        this.paddle.setStuckBall(ball);
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

            /*
            if (ball.position.y < 640 || ball.velocity.y < 0) ball.velocity.y = 1.5 * Math.sign(ball.velocity.y);
            else ball.velocity.y = 0.04 * Math.sign(ball.velocity.y);
            */

            ball.position.x += ball.velocity.x * dt;
            ball.position.y += ball.velocity.y * dt;

            const r = this.settings.ballRadius;

            // Handle wall collisions
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
            /*
            else if (ball.position.y + r >= this.settings.canvasHeight) {
                ball.position.y = this.settings.canvasHeight - r;
                ball.velocity.y = -ball.velocity.y;
            }
            */

            // Handle paddle collisions
            const paddleMinY = this.paddle.position.y - this.settings.paddleThickness / 2;
            const paddleMinX = this.paddle.position.x - this.settings.paddleThickness / 2; // End cap radius = thickness/2
            const paddleMaxX = this.paddle.position.x + this.paddle.width + this.settings.paddleThickness / 2; // As above
            // TODO: BUG: if the ball falls through, and you move the paddle over it, it "bounces" back from below!
            if (ball.velocity.y > 0 &&
                ball.position.y + r >= paddleMinY &&
                ball.position.x >= paddleMinX &&
                ball.position.x <= paddleMaxX && !this.gameLost) {
                    // Bounce angle depends on where the ball hits.
                    // First calculate the hit location (between 0 and 1, 0 being the leftmost point of the paddle),
                    // then calculate the bounce angle based on that location (0.5 = straight up),
                    // then calculate the velocity components based on the previous velocity magnitude and the bounce angle.
                    const hitLocation = (ball.position.x - paddleMinX) / (this.paddle.width + this.settings.paddleThickness); // Width + end cap radius * 2
                    const distanceOffCenter = Math.abs(0.5 - hitLocation);
                    const maxAngle = 85 * Math.PI/180;
                    const angle = 2 * distanceOffCenter * maxAngle * Math.sign(hitLocation - 0.5);
                    const speed = ball.velocity.mag();
                    ball.velocity.x = speed * Math.sin(angle);
                    ball.velocity.y = -(speed * Math.cos(angle));

                    if (Math.abs(ball.velocity.mag() - speed) > 0.01)
                        alert("BUG: Math error in paddle bounce");
                }
                else if (ball.velocity.y > 0 && ball.position.y > this.paddle.position.y) {
                    this.gameLost = true;
                }
                if (ball.velocity.y > 0 && ball.position.y > this.settings.canvasHeight + r) {
                    this.reset();
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
        this.ctx.lineWidth = this.settings.paddleThickness;
        this.ctx.stroke();
  //      this.ctx.fill();

        /*
        // Draw the paddle centerline
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#ff0000";
        this.ctx.moveTo(0, this.paddle.position.y);
        this.ctx.lineTo(this.settings.canvasWidth, this.paddle.position.y);
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        */

        // Draw the balls
        for (let ball of this.balls) {
            this.ctx.beginPath();
            this.ctx.fillStyle = ball.color;
            this.ctx.arc(ball.position.x, ball.position.y, this.settings.ballRadius, 0, 2*Math.PI);
            this.ctx.fill();
        }
    }
}