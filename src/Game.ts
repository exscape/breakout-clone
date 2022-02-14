import _ from 'lodash';
import { Settings } from './Settings';
import { Paddle } from "./Paddle";
import { Brick } from "./Brick";
import { Ball } from "./Ball";
import { Vec2 } from "./Vec2";
import { CollisionHandler } from './CollisionHandler';
import { Powerup, StickyPowerup, MultiballPowerup, TimeLimitedPowerup, RepetitionLimitedPowerup, PowerupType } from './Powerups';

function randomColor() {
    let colors = ["#38c600", "#0082f0", "#f6091f"];
    return _.sample(colors)!;
}

export class Game {
    canvas: HTMLCanvasElement;
    statusbarCanvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    sctx: CanvasRenderingContext2D;
    paddle: Paddle;
    balls: Ball[] = [];
    bricks: Brick[] = [];
    settings: Settings;
    collisionHandler: CollisionHandler;

    lastRender: number;
    lastFPS: number = 0;
    lifeLost: boolean = false;
    gameLost: boolean = false;
    gameWon: boolean = false;
    gamePaused: boolean = false;
    bricksRemaining: number = 0;

    activePowerups: Powerup[] = []; // Powerups that have been picked up and have an effect
    visiblePowerups: Powerup[] = []; // Powerups currently falling, yet to be picked up or lost
    multiballTimer: number = 0; // The timer ID of the ball-spawner setInterval call, used to cancel it later.

    loadingCompleted: boolean = false;

    livesRemaining: number = 0;
    score: number = 0;

    images: Record<string, HTMLImageElement> = {};

    constructor(canvas: HTMLCanvasElement, statusbarCanvas: HTMLCanvasElement, settings: Settings) {
        this.canvas = canvas;
        this.statusbarCanvas = statusbarCanvas;
        this.ctx = canvas.getContext('2d')!!;
        this.sctx = statusbarCanvas.getContext('2d')!!;

        this.paddle = new Paddle(settings);
        this.settings = settings;
        this.collisionHandler = new CollisionHandler(settings);

        let imageFilenames = ["brick_indestructible", "paddle_left", "paddle_center", "paddle_right",
                              "ball", "powerup_sticky", "powerup_multiball"];
        for (let i = 1; i <= 9; i++)
            imageFilenames.push(`brick${i}`);

        for (let name of imageFilenames) {
            var img = new Image();
            let self = this;
            img.addEventListener('load', function () {
                self.images[name] = this;
                if (Object.keys(self.images).length == imageFilenames.length)
                    self.loadingCompleted = true;
            }, false);
            img.addEventListener('error', (ev: ErrorEvent) => {
                alert(`Failed to load image ${name}! Error: ${ev.message}`);
            });
            img.src = `img/${name}.png`;
        }

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

        for (let powerup of this.activePowerups) {
            powerup.expire();
        }
        this.activePowerups.length = 0;
        this.visiblePowerups.length = 0;

        if (!partialReset) {
            this.bricks.length = 0;
            this.initializeBricks();
            this.bricksRemaining = this.bricks
                                       .filter(b => !b.indestructible)
                                       .length;

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
                if (_.random(1,100) > 90)
                    this.bricks.push(new Brick(new Vec2(xCoord, yCoord), `brick_indestructible`, this.settings, 10, 1, true));
                else
                    this.bricks.push(new Brick(new Vec2(xCoord, yCoord), `brick${_.random(1, 9)}`, this.settings, 10, 1));
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
/*        else
            this.spawnExtraBall(); */
    }

    spawnExtraBall(): boolean {
        if (!this.gamePaused && !this.paddle.stuckBall) {
            let b = new Ball(new Vec2(), new Vec2(), randomColor());
            this.balls.push(b);
            this.paddle.setStuckBall(b);
            this.paddle.launch();

            (this.getPowerup("multiball") as MultiballPowerup)?.trigger();

            return true;
        }
        else
            return false;
    }

    keyDown(ev: KeyboardEvent) {
        if (ev.key == "p" || ev.key == "P")
            this.togglePause();
    }

    keyUp(ev: KeyboardEvent) {}
    togglePause() { this.gamePaused = !this.gamePaused; }
    focusLost() { if (!this.gameWon && !this.gameLost) this.pause(); }
    pause() { this.gamePaused = true; }

    getPowerup(type: PowerupType): Powerup | null {
        let s = this.activePowerups.filter(p => p.type == type);
        if (s.length > 1)
            alert(`BUG: Multiple powerups of type ${type.toString()} active!`);
        return (s.length >= 1) ? s[0] : null;
    }

    isPowerupActive(type: PowerupType) {
        return this.getPowerup(type) !== null;
    }

    update(dt: number) {
        if (this.gameWon || this.gamePaused) // if gameLost, update() should still run, so the ball is drawn to exit the game area
            return;

        // Handle expiry of active powerups
        for (let p of this.activePowerups) {
            if (p instanceof TimeLimitedPowerup)
                p.tick(dt);
        }
        this.activePowerups = this.activePowerups.filter(p => !p.expired);

        // Animate powerups falling
        for (let i = this.visiblePowerups.length - 1; i >= 0; i--) {
            let p = this.visiblePowerups[i];
            p.position.y += this.settings.powerupFallSpeed * dt;

            if (p.position.y - this.settings.powerupImageRadius > this.settings.canvasHeight) {
                this.visiblePowerups.splice(i, 1);
            }
        }

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

        // Used for ball-paddle and powerup-paddle collisions, below
        const paddleTopY = this.paddle.position.y - this.settings.paddleThickness / 2;
        const paddleLeftmostX = this.paddle.position.x - this.settings.paddleThickness / 2; // End cap radius = thickness/2
        const paddleRightmostX = this.paddle.position.x + this.paddle.width + this.settings.paddleThickness / 2; // As above

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

                if (!brick.indestructible)
                    brick.health--;
                if (brick.health <= 0) {
                    this.score += brick.score;
                    this.bricks.splice(i, 1);
                    this.bricksRemaining--;

                    if (_.random(1, 100) <= this.settings.powerupProbability) {
                        // Spawn a random powerup
                        let powerup: Powerup;
                        let spawnPosition = new Vec2(brick.bottomLeft.x + this.settings.brickWidth / 2, brick.upperLeft.y + this.settings.brickHeight / 2);
                        if (_.random(0,1) == 0) {
                            // Sticky powerup
                            powerup = new StickyPowerup(spawnPosition);
                            powerup.setActivatedCallback(() => {
                                this.paddle.sticky++;
                            });
                            powerup.setDeactivatedCallback(() => {
                                this.paddle.sticky--;
                            });
                        }
                        else {
                            // Multiball powerup
                            powerup = new MultiballPowerup(spawnPosition);
                            powerup.setActivatedCallback(() => {
                                this.spawnExtraBall();
                                this.multiballTimer = window.setInterval(() => { this.spawnExtraBall(); }, this.settings.multiballSpawnInterval);
                            });
                            powerup.setDeactivatedCallback(() => {
                                if (this.multiballTimer)
                                    window.clearInterval(this.multiballTimer);
                                this.multiballTimer = 0;
                            });
                        }
                        this.visiblePowerups.push(powerup);
                    }
                }

                if (this.bricksRemaining <= 0)
                    this.win();

                break; // Limit collisions to the first block tested
            }

            // Handle paddle collisions and lost lives/lost games
            const r = this.settings.ballRadius;
            if (ball.velocity.y > 0 &&
                ball.position.y + r >= paddleTopY &&
                ball.position.x >= paddleLeftmostX &&
                ball.position.x <= paddleRightmostX &&
                ball.position.y + r < this.paddle.position.y + this.settings.paddleThickness / 2 && // + thickness/2 to reduce risk of fall-through at lower fps
                !this.gameLost &&
                !this.lifeLost) {
                if (this.paddle.sticky > 0 && this.paddle.stuckBall == null) {
                    // The ball should stick to the paddle.
                    // If the paddle is sticky but HAS a stuck ball, we let it bounce as usual.
                    this.paddle.setStuckBall(ball);
                    ball.velocity.x = 0;
                    ball.velocity.y = 0;

                    (this.getPowerup("sticky") as StickyPowerup)?.trigger();
                }
                else {
                    // Bounce angle depends on where the ball hits.
                    // First calculate the hit location (between 0 and 1, 0 being the leftmost point of the paddle),
                    // then calculate the bounce angle based on that location (0.5 = straight up),
                    // then calculate the velocity components based on the previous velocity magnitude and the bounce angle.
                    const hitLocation = (ball.position.x - paddleLeftmostX) / (this.paddle.width + this.settings.paddleThickness); // Width + end cap radius * 2
                    const distanceOffCenter = Math.abs(0.5 - hitLocation);
                    const maxAngle = 80 * Math.PI/180;
                    const angle = 2 * distanceOffCenter * maxAngle * Math.sign(hitLocation - 0.5);
                    const speed = ball.velocity.mag();
                    ball.velocity.x = speed * Math.sin(angle);
                    ball.velocity.y = -speed * Math.cos(angle);
                    ball.collided = true;
                }
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

        // Finally, ensure no ball is moving strictly horizontally or vertically to prevent them from getting stuck.
        for (let ball of this.balls)
            ball.correctVelocity(this.settings);

        // Handle powerup pick-ups
        const r = this.settings.powerupImageRadius;
        for (let i = this.visiblePowerups.length - 1; i >= 0; i--) {
            let powerup = this.visiblePowerups[i];
            /*
                ball.position.y + r >= paddleTopY &&
                ball.position.x >= paddleLeftmostX &&
                ball.position.x <= paddleRightmostX &&
                ball.position.y + r < this.paddle.position.y + this.settings.paddleThickness / 2 && // + thickness/2 to reduce risk of fall-through at lower fps
                !this.gameLost &&
                !this.lifeLost) {
            */
            if (powerup.position.y + r >= paddleTopY &&
                powerup.position.x >= paddleLeftmostX &&
                powerup.position.x <= paddleRightmostX &&
                powerup.position.y - r < this.paddle.position.y &&
                !this.gameLost &&
                !this.lifeLost) {
                    let existingPowerup = this.getPowerup(powerup.type);
                    if (existingPowerup)
                        existingPowerup.addInstance();
                    else {
                        powerup.activate();
                        this.activePowerups.push(powerup);
                    }

                    this.visiblePowerups.splice(i, 1);
                    // TODO: animate the disappearance
                }
        }
    }

    gameLoop(timestamp: number) {
        var dt = timestamp - this.lastRender

        this.update(dt)
        this.drawFrame()

        this.lastRender = timestamp
        this.lastFPS = 1000/dt;
        window.requestAnimationFrame((dt) => this.gameLoop(dt));
    }

    drawText(text: string, font: string, fillStyle: string, textAlign: CanvasTextAlign, x: number, y: number, context = this.ctx) {
        context.font = font;
        context.fillStyle = fillStyle;
        context.textAlign = textAlign;
        if (textAlign == "center")
            x = this.settings.canvasWidth / 2;
        context.fillText(text, x, y);
    }

    dim() {
        // Draw a partially transparent overlay
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);
        this.ctx.globalAlpha = 1.0;
    }

    drawFrame() {
        // Draw the status bar
        this.drawStatusBar();

        // Clear the frame
        this.ctx.fillStyle = this.settings.canvasBackground;
        this.ctx.fillRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);

        if (!this.loadingCompleted) {
            this.drawText("Loading images...", "30px Arial", "#ee3030", "center", 0, 400);
            return;
        }

        // Draw the paddle
        // paddleThickness/2 is also the end cap radius, so we need to subtract that from x as well
        this.ctx.drawImage(this.images["paddle_left"], this.paddle.position.x - Math.floor(this.settings.paddleThickness / 2), this.paddle.position.y - this.settings.paddleThickness / 2);
        this.ctx.drawImage(this.images["paddle_center"], this.paddle.position.x - Math.floor(this.settings.paddleThickness / 2) + 12, this.paddle.position.y - this.settings.paddleThickness / 2);
        this.ctx.drawImage(this.images["paddle_right"], this.paddle.position.x + this.paddle.width, this.paddle.position.y - this.settings.paddleThickness / 2);

        // Draw the paddle sticky effect
        if (this.paddle.sticky) {
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            this.ctx.strokeStyle = "#45ff45";
            this.ctx.lineCap = "round";
            this.ctx.moveTo(this.paddle.position.x, this.paddle.position.y);
            this.ctx.lineTo(this.paddle.position.x + this.paddle.width, this.paddle.position.y);
            this.ctx.lineWidth = this.settings.paddleThickness;
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }

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
            this.ctx.drawImage(this.images[brick.name], brick.upperLeft.x, brick.upperLeft.y, this.settings.brickWidth, this.settings.brickHeight);
        }

        // Draw powerups
        for (let powerup of this.visiblePowerups) {
            const r = this.settings.powerupImageRadius;
            this.ctx.drawImage(this.images[powerup.image], powerup.position.x - r, powerup.position.y - r, r * 2, r * 2);
        }

        // Draw the balls
        for (let ball of this.balls) {
            this.ctx.drawImage(this.images["ball"], ball.position.x - this.settings.ballRadius, ball.position.y - this.settings.ballRadius);

            /*
            this.ctx.globalAlpha = 0.7;
            this.ctx.beginPath();
            this.ctx.fillStyle = "red";
            this.ctx.arc(ball.position.x, ball.position.y, this.settings.ballRadius, 0, 2*Math.PI);
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
            */

            // Draw the velocity vector(s)
            if (this.gamePaused && ball.velocity.mag() > 0.1) {
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

    drawStatusBar() {
        this.sctx.fillStyle = "white";
        this.sctx.fillRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);

        // Draw temporary powerup stats
        let s = "";
        for (let powerup of this.activePowerups) {
            if (powerup instanceof RepetitionLimitedPowerup)
                s += `[${powerup.name}: ${powerup.repetitions}/${powerup.maxRepetitions}] `;
        }

        this.drawText(s, "Arial 18 px", "black", "left", 25, 15, this.sctx);
    }
}