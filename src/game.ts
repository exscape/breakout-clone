import { Paddle, Ball, Brick, Settings, Vec2 } from './models';
import _ from 'lodash';

enum CollisionFrom {
    None,
    Left,
    Right,
    Top,
    Bottom
}

function randomColor() {
    let colors = ["#38c600", "#0082f0", "#f6091f"];
    return _.sample(colors)!;
}

function isAboveLine(corner: Vec2, oppositeCorner: Vec2, ballCenter: Vec2) {
    return ((oppositeCorner.x - corner.x) * (ballCenter.y - corner.y) - (oppositeCorner.y - corner.y) * (ballCenter.x - corner.x)) > 0;
}

export class Game {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    paddle: Paddle;
    balls: Ball[] = [];
    bricks: Brick[] = [];
    settings: Settings;
    brickImage: HTMLImageElement | null = null;

    lastRender: number;
    lastFPS: number = 0;
    lifeLost: boolean = false;
    gameLost: boolean = false;
    gameWon: boolean = false;
    gamePaused: boolean = false;

    livesRemaining: number = 0;

    constructor(canvas: HTMLCanvasElement, settings: Settings) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!!;
        this.paddle = new Paddle(settings);
        this.settings = settings;

        this.reset();

        var img = new Image();
        img.addEventListener('load', () => {
            this.brickImage = img;
            console.log("brick.png loaded");
        }, false);
        img.onload = () => { console.log("img onload");}
        img.src = 'brick.png';
        console.log("Starting load for brick.png");

        this.lastRender = 0;
        window.requestAnimationFrame((dt) => this.gameLoop(dt));
    }

    reset() {
        // If the game isn't lost and lives remain, we do a partial reset.
        let partialReset = !this.gameLost && this.livesRemaining > 0;

        this.lifeLost = false;
        this.gameLost = false;
        this.gameWon = false;
        this.gamePaused = false;
        this.balls.length = 0; // Why is there no clear method?!

        if (!partialReset) {
            this.bricks.length = 0;
            this.initializeBricks();

            this.livesRemaining = 3;
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
        const numBricksX = 12;
        const numBricksY = 10;
        for (let y = 100; y < 100 + numBricksY * (this.settings.brickHeight + 4); y += (this.settings.brickHeight + 4)) {
            for (let i = 0; i < numBricksX; i++) {
                const x = 102 + i * (this.settings.brickWidth + (i > 0 ? 4 : 0));
                this.bricks.push(new Brick(new Vec2(x, y), randomColor(), this.settings, 1));
            }
        }
    }

    mouseMoved(e: MouseEvent) {
        if (!this.gamePaused && !this.gameLost && !this.gameWon && !this.lifeLost)
            this.paddle.move(e.movementX, e.movementY);
    }

    click() {
        if (this.gameLost) {
            this.reset();
            return;
        }

        if (this.paddle.stuckBall && !this.gamePaused)
            this.paddle.launch();
    }

    keyDown(ev: KeyboardEvent) {
        if (ev.key == "p" || ev.key == "P")
            this.togglePause();
    }

    keyUp(ev: KeyboardEvent) {}
    togglePause() { this.gamePaused = !this.gamePaused; }

    update(dt: number) {
        if (this.gameWon || this.gamePaused) // if gameLost, update() should still run, so the ball is drawn to exit the game area
            return;

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

            ball.prevPosition.x = ball.position.x;
            ball.prevPosition.y = ball.position.y;

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

            // Handle roof (and during testing, floor) collisions
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

            // Handle brick collisions
            // We'll try it the naive way first and see how it performs...
            // With less than 200 bricks surely this should be fine?
            for (let i = 0; i < this.bricks.length; i++) {
                let brick = this.bricks[i];
                let collision = this.brickCollision(ball, brick);
                if (collision == CollisionFrom.None)
                    continue;

                // console.log(`Brick collision! Type = ${(collision == CollisionFrom.Left || CollisionFrom.Right) ? "X" : "Y"}, bouncing`);

                brick.health--;
                if (brick.health <= 0)
                    this.bricks.splice(i, 1);

                if (this.bricks.length == 0)
                    this.win();

                if (collision == CollisionFrom.Top || collision == CollisionFrom.Bottom) {
                    ball.velocity.y = -ball.velocity.y;
                    ball.position.y += 2* ball.velocity.y * dt; // TODO: HACK! Restore the ball position properly!
                }
                else {
                    ball.velocity.x = -ball.velocity.x;
                    ball.position.x += 2* ball.velocity.x * dt; // TODO: HACK! Restore the ball position properly!
                }

                break; // Limit collisions to the first block tested
            }

            // Handle paddle collisions and lost lives/lost games
            const paddleMinY = this.paddle.position.y - this.settings.paddleThickness / 2;
            const paddleMinX = this.paddle.position.x - this.settings.paddleThickness / 2; // End cap radius = thickness/2
            const paddleMaxX = this.paddle.position.x + this.paddle.width + this.settings.paddleThickness / 2; // As above
            if (ball.velocity.y > 0 &&
                ball.position.y + r >= paddleMinY &&
                ball.position.x >= paddleMinX &&
                ball.position.x <= paddleMaxX &&
                !this.gameLost &&
                !this.lifeLost) {
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
                    ball.velocity.y = -speed * Math.cos(angle);
                }
                else if (ball.velocity.y > 0 && ball.position.y > this.paddle.position.y) {
                    // Only subtract if lifeLost == false, since we will subtract a life every frame otherwise.
                    if (!this.lifeLost) {
                        this.livesRemaining--;
                        this.lifeLost = true;
                    }
                    if (this.livesRemaining <= 0)
                        this.gameLost = true;
                }
                if (ball.velocity.y > 0 && ball.position.y > this.settings.canvasHeight + r) {
                    // If livesRemaining == 0, we display the "you lost" screen and wait for user input
                    // to reset.
                    if (this.livesRemaining > 0)
                        this.reset();
                }

            // TODO: handle collisions between balls -- if multiball is ever added
        }
    }

    brickCollision(ball: Ball, brick: Brick): CollisionFrom {
        // Calculates whether the ball and brick are colliding, and if so, from which direction the ball is coming.
        // TODO: Walk through this very carefully to ensure the ball can't slip through, e.g. on a corner pixel
        // TODO: Return collision direction
        let {x, y} = ball.position;

        // TODO: Use ball.velocity to figure out collision direction

        if (ball.position.x <= brick.upperLeft.x) {
            x = brick.upperLeft.x;
        }
        else if (ball.position.x > brick.upperLeft.x + this.settings.brickWidth) {
            x = brick.upperLeft.x + this.settings.brickWidth;
        }

        if (ball.position.y <= brick.upperLeft.y) {
            y = brick.upperLeft.y;
        }
        else if (ball.position.y > brick.upperLeft.y + this.settings.brickHeight) {
            y = brick.upperLeft.y + this.settings.brickHeight;
        }

        // Note: If the ball (center) is inside the brick, i.e. the above if statements aren't run,
        // the default x/y values will make this expression zero, and so still register a collision.
        let dist = Math.sqrt((ball.position.x - x)**2 + (ball.position.y - y)**2);

        if (dist > this.settings.ballRadius)
            return CollisionFrom.None;
        else
            return this.collisionDirection(ball, brick);
    }

    collisionDirection(ball: Ball, brick: Brick): CollisionFrom {
        // Based on:
        // https://stackoverflow.com/questions/19198359/how-to-determine-which-side-of-a-rectangle-collides-with-a-circle/19202228#19202228

        let isAboveAC = isAboveLine(brick.bottomRight, brick.upperLeft, ball.position);
        let isAboveDB = isAboveLine(brick.upperRight, brick.bottomLeft, ball.position);

        if (isAboveAC)
            return isAboveDB ? CollisionFrom.Top : CollisionFrom.Right;
        else
            return isAboveDB ? CollisionFrom.Left : CollisionFrom.Bottom;
    }

    gameLoop(timestamp: number) {
        var dt = timestamp - this.lastRender

        this.update(dt)
        this.drawFrame()

        this.lastRender = timestamp
        this.lastFPS = 1000/dt;
        window.requestAnimationFrame((dt) => this.gameLoop(dt));
    }

    drawFrame() {
        // Clear the frame
        this.ctx.clearRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);

        if (this.gameWon) {
            this.ctx.font = "30px Arial";
            this.ctx.fillStyle = "#ee3030";
            this.ctx.fillText("A WINNER IS YOU!", 300, 300);
            return;
        }

        // Ensure the image has loaded
        if (!this.brickImage) {
            this.ctx.font = "30px Arial";
            this.ctx.fillStyle = "#ee3030";
            this.ctx.fillText("Loading images...", 300, 300);
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
        this.ctx.font = "14px Arial";
        this.ctx.fillStyle = "#ee3030";
        this.ctx.fillText("FPS: " + Math.round(this.lastFPS), 15, 35);
        */

        // Draw the number of lives remaining
        this.ctx.font = "18px Arial";
        this.ctx.fillStyle = "black";
        this.ctx.fillText(`Lives remaining: ${this.livesRemaining}`, 10, 25);

        if (this.gamePaused) {
            this.ctx.font = "100px Arial Bold";
            this.ctx.fillStyle = "black";
            this.ctx.textAlign = "center";
            this.ctx.fillText("PAUSED", this.settings.canvasWidth / 2, 520);
            this.ctx.textAlign = "left";
        }
        else if (this.gameLost) {
            this.ctx.font = "60px Arial";
            this.ctx.fillStyle = "#ee3030";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Sorry, you lost! Click to restart the game.", this.settings.canvasWidth / 2, 540);
            this.ctx.textAlign = "left";
            return;
        }

    }
}