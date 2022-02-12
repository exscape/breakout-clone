import _ from 'lodash';
import { Settings } from './Settings';
import { Paddle } from "./Paddle";
import { Brick } from "./Brick";
import { Ball } from "./Ball";
import { Vec2 } from "./Vec2";
import { CollisionHandler } from './CollisionHandler';

function randomColor() {
    let colors = ["#38c600", "#0082f0", "#f6091f"];
    return _.sample(colors)!;
}

export class Game {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    paddle: Paddle;
    balls: Ball[] = [];
    bricks: Brick[] = [];
    settings: Settings;
    collisionHandler: CollisionHandler;
    brickImage: HTMLImageElement | null = null;

    lastRender: number;
    lastFPS: number = 0;
    lifeLost: boolean = false;
    gameLost: boolean = false;
    gameWon: boolean = false;
    gamePaused: boolean = false;

    livesRemaining: number = 0;
    score: number = 0;

    constructor(canvas: HTMLCanvasElement, settings: Settings) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!!;
        this.paddle = new Paddle(settings);
        this.settings = settings;
        this.collisionHandler = new CollisionHandler(settings);

        var img = new Image();
        img.addEventListener('load', () => {
            this.brickImage = img;
            console.log("brick.png loaded");
        }, false);
        img.src = 'brick.png';
        console.log("Starting load for brick.png");

        this.reset();

        this.lastRender = 0;
        window.requestAnimationFrame((dt) => this.gameLoop(dt));
    }

    reset() {
        // If the game is still active and lives remain, we do a partial reset.
        // Otherwise, reset everything -- i.e. restart the game entirely.
        let partialReset = !this.gameLost && !this.gameWon && this.livesRemaining > 0;

        this.lifeLost = false;
        this.gameLost = false;
        this.gameWon = false;
        this.gamePaused = false;
        this.balls.length = 0; // Why is there no clear method?!

        if (!partialReset) {
            this.bricks.length = 0;
            this.initializeBricks();

            this.livesRemaining = 3;
            this.score = 0;
        }

        let ball = new Ball(new Vec2(), new Vec2(), "black");
        this.balls.push(ball);
        this.paddle.setStuckBall(ball);
    }

    win() {
        this.gameWon = true;
    }

    initializeBricks() {
        // Will be changed massively later.
        // For now, we have "brick spots" along the entire canvas width, but the 1st map has the leftmost and rightmost columns empty.
        // Previously, those spots were empty and coded such that they must ALWAYS BE empty, but I don't want that to be the case later.
        // We moved from 12 x 10 fixed bricks when making this change.
        const numBricksX = 14;
        const numBricksY = 14;
        const firstRow = 3;
        const xMargin = 1;
        const spacing = 4;

        for (let y = firstRow; y < numBricksY; y++) {
            for (let x = xMargin; x < numBricksX - xMargin; x++) {
                let xCoord = spacing + x * (this.settings.brickWidth + (x > 0 ? spacing : 0));
                let yCoord = spacing + y * (this.settings.brickHeight + (y > 0 ? spacing : 0));
                this.bricks.push(new Brick(new Vec2(xCoord, yCoord), randomColor(), this.settings, 10, 1));
            }
        }
    }

    mouseMoved(e: MouseEvent) {
        if (!this.gamePaused && !this.gameLost && !this.gameWon && !this.lifeLost)
            this.paddle.move(e.movementX, e.movementY);
    }

    click() {
        if (this.gameLost || this.gameWon) {
            this.reset();
            return;
        }

        if (this.paddle.stuckBall && !this.gamePaused)
            this.paddle.launch();
        else {
            // TODO: TEMPORARY CODE to test multiball
            let b = new Ball(new Vec2(), new Vec2(), randomColor());
            this.balls.push(b);
            this.paddle.setStuckBall(b);
            this.paddle.launch();
        }
    }

    keyDown(ev: KeyboardEvent) {
        if (ev.key == "p" || ev.key == "P")
            this.togglePause();
    }

    keyUp(ev: KeyboardEvent) {}
    togglePause() { this.gamePaused = !this.gamePaused; }
    focusLost() { if (!this.gameWon && !this.gameLost) this.pause(); }
    pause() { this.gamePaused = true; }

    update(dt: number) {
        if (this.gameWon || this.gamePaused) // if gameLost, update() should still run, so the ball is drawn to exit the game area
            return;

        // Update the position of all balls first...
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

            ball.collided = false;
        }

        // ... *then* handle collisions
        for (let ball of this.balls) {
            // Handle wall collisions; reflects the ball if necessary
            this.collisionHandler.handleWallCollisions(ball);

            // Limit to one collision per ball and frame
            if (ball.collided)
                continue;

            // Handle brick collisions
            // Naive, but it performs just fine. I can even run it 500 times per brick and still have 165 fps.
            for (let i = 0; i < this.bricks.length; i++) {
                let brick = this.bricks[i];
                if (!this.collisionHandler.brickCollision(ball, brick, dt))
                    continue;

                ball.collided = true;

                brick.health--;
                if (brick.health <= 0) {
                    this.score += brick.score;
                    this.bricks.splice(i, 1);
                }

                if (this.bricks.length == 0)
                    this.win();

                break; // Limit collisions to the first block tested
            }

            // Handle paddle collisions and lost lives/lost games
            const r = this.settings.ballRadius;
            const paddleMinY = this.paddle.position.y - this.settings.paddleThickness / 2;
            const paddleMinX = this.paddle.position.x - this.settings.paddleThickness / 2; // End cap radius = thickness/2
            const paddleMaxX = this.paddle.position.x + this.paddle.width + this.settings.paddleThickness / 2; // As above
            if (ball.velocity.y > 0 &&
                ball.position.y + r >= paddleMinY &&
                ball.position.x >= paddleMinX &&
                ball.position.x <= paddleMaxX &&
                ball.position.y + r < this.paddle.position.y + this.settings.paddleThickness / 2 && // + thickness/2 to reduce risk of fall-through at lower fps
                !this.gameLost &&
                !this.lifeLost) {
                // Bounce angle depends on where the ball hits.
                // First calculate the hit location (between 0 and 1, 0 being the leftmost point of the paddle),
                // then calculate the bounce angle based on that location (0.5 = straight up),
                // then calculate the velocity components based on the previous velocity magnitude and the bounce angle.
                const hitLocation = (ball.position.x - paddleMinX) / (this.paddle.width + this.settings.paddleThickness); // Width + end cap radius * 2
                const distanceOffCenter = Math.abs(0.5 - hitLocation);
                const maxAngle = 80 * Math.PI/180;
                const angle = 2 * distanceOffCenter * maxAngle * Math.sign(hitLocation - 0.5);
                const speed = ball.velocity.mag();
                ball.velocity.x = speed * Math.sin(angle);
                ball.velocity.y = -speed * Math.cos(angle);
                ball.collided = true;
            }
            else if (ball.velocity.y > 0 && ball.position.y > this.settings.canvasHeight + r) {
                // Only subtract if lifeLost == false, since we will subtract a life every frame otherwise.
                let i = this.balls.indexOf(ball);
                this.balls.splice(i, 1);

                if (this.balls.length === 0) {
                    if (!this.lifeLost) {
                        this.livesRemaining--;
                        this.lifeLost = true;
                    }
                    if (this.livesRemaining <= 0)
                        this.gameLost = true;
                    else
                        this.reset();
                }
            }
            if (ball.velocity.y > 0 && ball.position.y > this.settings.canvasHeight + r) {
                // If livesRemaining == 0, we instead display the "you lost" screen and wait for user input
                // to reset.
                if (this.balls.length == 0 && this.livesRemaining > 0)
                    this.reset();
            }
        }

        // Handle ball-to-ball collisions
        if (this.balls.length >= 2)
            this.collisionHandler.handleBallBallCollisions(this.balls);
    }

    gameLoop(timestamp: number) {
        var dt = timestamp - this.lastRender

        this.update(dt)
        this.drawFrame()

        this.lastRender = timestamp
        this.lastFPS = 1000/dt;
        window.requestAnimationFrame((dt) => this.gameLoop(dt));
    }

    drawText(text: string, font: string, fillStyle: string, textAlign: CanvasTextAlign, x: number, y: number) {
            this.ctx.font = font;
            this.ctx.fillStyle = fillStyle;
            this.ctx.textAlign = textAlign;
            if (textAlign == "center")
                x = this.settings.canvasWidth / 2;
            this.ctx.fillText(text, x, y);
    }

    drawFrame() {
        // Clear the frame
        this.ctx.clearRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);

        // Ensure the image has loaded
        if (!this.brickImage) {
            this.drawText("Loading images...", "30px Arial", "#ee3030", "center", 0, 400);
            return;
        }

        // Draw the paddle
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#5050d0";
        this.ctx.lineCap = "round";
        this.ctx.moveTo(this.paddle.position.x, this.paddle.position.y);
        this.ctx.lineTo(this.paddle.position.x + this.paddle.width, this.paddle.position.y);
        this.ctx.lineWidth = this.settings.paddleThickness;
        this.ctx.stroke();

        /*
        // Draw the paddle centerline
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#ff0000";
        this.ctx.moveTo(0, this.paddle.position.y);
        this.ctx.lineTo(this.settings.canvasWidth, this.paddle.position.y);
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        */

        /*
        // Draw aim line
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#ff0000";
        this.ctx.moveTo(this.paddle.position.x + this.paddle.width / 2, this.paddle.position.y);
        this.ctx.lineTo(this.paddle.position.x + this.paddle.width / 2, 0);
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        */

        // Draw the bricks
        for (let brick of this.bricks) {
            this.ctx.drawImage(this.brickImage, brick.upperLeft.x, brick.upperLeft.y, this.settings.brickWidth, this.settings.brickHeight);
        }

        // Draw the balls
        for (let ball of this.balls) {
            this.ctx.beginPath();
            this.ctx.fillStyle = ball.color;
            this.ctx.arc(ball.position.x, ball.position.y, this.settings.ballRadius, 0, 2*Math.PI);
            this.ctx.fill();

            // Draw the velocity vector(s)
            if (this.gamePaused) {
                this.ctx.beginPath();
                this.ctx.lineWidth = 2;
                this.ctx.strokeStyle = "#60ff60";
                this.ctx.moveTo(ball.position.x, ball.position.y);
                this.ctx.lineTo(ball.position.x + ball.velocity.x * 100, ball.position.y + ball.velocity.y * 100);
                this.ctx.stroke();
            }
        }

        /*
        // Draw the current framerate
        this.drawText(`FPS: ${Math.floor(this.lastFPS)}`, "18px Arial", "#ee3030", "left", 10, 59);
        */

        // Draw player stats
        this.drawText(`Score: ${this.score}`, "18px Arial", "black", "left", 10, 25)
        this.drawText(`Lives remaining: ${this.livesRemaining}`, "18px Arial", "black", "left", 10, 42);

        if (this.gameWon) {
            this.drawText(`A WINNER IS YOU!`, "60px Arial", "#ee3030", "center", 0, 520);
            this.drawText(`Score: ${this.score}`, "60px Arial", "#ee3030", "center", 0, 580);
            this.drawText("Click to restart the game.", "40px Arial", "#ee3030", "center", 0, 635);
        }

        if (this.gamePaused) {
            this.drawText("PAUSED", "100px Arial Bold", "black", "center", 0, 520);
        }
        else if (this.gameLost) {
            this.drawText(`Sorry, you lost!`, "60px Arial", "#ee3030", "center", 0, 520);
            this.drawText(`Score: ${this.score}`, "60px Arial", "#ee3030", "center", 0, 580);
            this.drawText("Click to restart the game.", "40px Arial", "#ee3030", "center", 0, 635);
            return;
        }
    }
}