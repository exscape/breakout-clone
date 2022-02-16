import _ from 'lodash';
import { Settings } from './Settings';
import { Paddle } from "./Paddle";
import { Brick } from "./Brick";
import { Ball } from "./Ball";
import { Vec2 } from "./Vec2";
import { CollisionHandler } from './CollisionHandler';
import { Powerup, StickyPowerup, MultiballPowerup, TimeLimitedPowerup, RepetitionLimitedPowerup, PowerupType, FireballPowerup } from './Powerups';
import { debugAlert } from './Utils';

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
    aimDashOffset: number = 0; // Used to animate the aiming line for the sticky powerup

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
                              "ball", "powerup_sticky", "powerup_multiball", "powerup_fireball", "fireball",
                              "statusbar"];
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
        else if (this.isPowerupActive("multiball"))
            this.spawnExtraBall();
    }

    spawnExtraBall(): boolean {
        if (this.gamePaused || this.paddle.stuckBall)
            return false;

        let newBall = new Ball(new Vec2(), new Vec2(), randomColor());

        if (this.isPowerupActive("fireball"))
            newBall.fireball = true;

        this.balls.push(newBall);
        this.paddle.setStuckBall(newBall);
        this.paddle.launch();

        (this.getPowerup("multiball") as MultiballPowerup)?.trigger();

        return true;
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
            debugAlert(`BUG: Multiple powerups of type ${type.toString()} active!`);
        return (s.length >= 1) ? s[0] : null;
    }

    isPowerupActive(type: PowerupType) {
        return this.getPowerup(type) !== null;
    }

    update(dt: number) {
        // if gameLost, update() should still run, so the ball is drawn to exit the game area
        if (this.gameWon || this.gamePaused)
            return;

        // Animate the aiming line (if visible)
        this.aimDashOffset -= 0.07 * dt;

        this.checkPowerupExpiry(dt);
        this.animateFallingPowerups(dt);
        this.updateBallPositions(dt);

        // Used for ball-paddle and powerup-paddle collisions, below
        const paddleTopY = this.paddle.position.y - this.settings.paddleThickness / 2;
        const paddleLeftmostX = this.paddle.position.x - this.settings.paddleThickness / 2; // End cap radius = thickness/2
        const paddleRightmostX = this.paddle.position.x + this.paddle.width + this.settings.paddleThickness / 2; // As above

        // Handle collisions with walls and bricks
        for (let ball of this.balls) {
            this.collisionHandler.handleWallCollisions(ball);

            // Limit to one collision per ball and frame
            if (ball.collided)
                continue;

            this.handleBrickCollisions(ball, dt);

            this.handlePaddleCollisions(ball, paddleTopY, paddleLeftmostX, paddleRightmostX);

            // Handle balls falling past the bottom edge
            if (ball.velocity.y > 0 && ball.position.y - this.settings.ballRadius > this.settings.canvasHeight)
                this.ballLost(ball);

            if (ball.velocity.y > 0 && ball.position.y > this.settings.canvasHeight + this.settings.ballRadius &&
                this.balls.length === 0 && this.livesRemaining > 0) {
                // If livesRemaining == 0, we instead display the "you lost" screen and wait for user input
                // to reset.
                this.reset();
            }
        }

        // Handle ball-to-ball collisions
        if (this.balls.length >= 2)
            this.collisionHandler.handleBallBallCollisions(this.balls);

        // Ensure no ball is moving strictly horizontally or vertically to prevent them from getting stuck.
        for (let ball of this.balls)
            ball.correctVelocity(this.settings);

        // Handle powerup pick-ups
        this.handlePowerupPickups(paddleTopY, paddleLeftmostX, paddleRightmostX);
    }

    handlePaddleCollisions(ball: Ball, paddleTopY: number, paddleLeftmostX: number, paddleRightmostX: number) {
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
    }


    ballLost(ball: Ball) {
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

    handleBrickCollisions(ball: Ball, dt: number) {
        for (let i = 0; i < this.bricks.length; i++) {
            let brick = this.bricks[i];
            if (!this.collisionHandler.brickCollision(ball, brick, dt))
                continue;

            ball.collided = true;

            if (!brick.indestructible && !ball.fireball)
                brick.health--;
            else if (!brick.indestructible && ball.fireball)
                brick.health = 0;

            if (brick.health <= 0) {
                this.score += Math.floor(brick.score * (ball.fireball ? 1.40 : 1));
                this.bricks.splice(i, 1);
                this.bricksRemaining--;

                if (_.random(1, 100) <= this.settings.powerupProbability) {
                    let spawnPosition = new Vec2(brick.bottomLeft.x + this.settings.brickWidth / 2, brick.upperLeft.y + this.settings.brickHeight / 2);
                    this.spawnRandomPowerup(spawnPosition);
                }
            }

            if (this.bricksRemaining <= 0)
                this.win();

            break; // Limit collisions to the first block tested
        }
    }

    private handlePowerupPickups(paddleTopY: number, paddleLeftmostX: number, paddleRightmostX: number) {
        const r = this.settings.powerupImageRadius;
        for (let i = this.visiblePowerups.length - 1; i >= 0; i--) {
            let powerup = this.visiblePowerups[i];

            if (powerup.position.y + r >= paddleTopY &&
                powerup.position.x >= paddleLeftmostX &&
                powerup.position.x <= paddleRightmostX &&
                powerup.position.y - r < this.paddle.position.y &&
                !this.gameLost &&
                !this.lifeLost) {
                let existingPowerup = this.getPowerup(powerup.type);
                this.score += powerup.pickupScore;
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

    private checkPowerupExpiry(dt: number) {
        for (let p of this.activePowerups) {
            if (p instanceof TimeLimitedPowerup)
                p.tick(dt);
        }
        this.activePowerups = this.activePowerups.filter(p => !p.expired);
    }

    private animateFallingPowerups(dt: number) {
        for (let i = this.visiblePowerups.length - 1; i >= 0; i--) {
            let p = this.visiblePowerups[i];
            p.position.y += this.settings.powerupFallSpeed * dt;

            if (p.position.y - this.settings.powerupImageRadius > this.settings.canvasHeight) {
                this.visiblePowerups.splice(i, 1);
            }

            p.phase += Math.PI / 2 * dt / 300;
        }
    }

    private updateBallPositions(dt: number) {
        for (let ball of this.balls) {
            if (ball.stuck) {
                if (ball.velocity.x != 0 || ball.velocity.y != 0)
                    debugAlert("BUG: velocity != 0 while ball is stuck!");
                continue;
            }

            ball.rotation += Math.PI/200 * dt;
            if (ball.rotation > 2 * Math.PI)
                ball.rotation -= 2 * Math.PI;

            ball.position.x += ball.velocity.x * dt;
            ball.position.y += ball.velocity.y * dt;

            ball.collided = false;
        }
    }

    private spawnRandomPowerup(spawnPosition: Vec2) {
        let powerup: Powerup;
        let rand = _.random(0, 2);
        if (rand == 0) {
            // Sticky powerup
            powerup = new StickyPowerup(spawnPosition);
            powerup.setActivatedCallback(() => {
                this.paddle.sticky++;
            });
            powerup.setDeactivatedCallback(() => {
                this.paddle.sticky--;
            });
        }
        else if (rand == 1) {
            // Multiball powerup
            powerup = new MultiballPowerup(spawnPosition);
        }
        else {
            powerup = new FireballPowerup(spawnPosition);
            powerup.setActivatedCallback(() => {
                for (let ball of this.balls) {
                    ball.fireball = true;
                }
            });
            powerup.setDeactivatedCallback(() => {
                for (let ball of this.balls) {
                    ball.fireball = false;
                }
            });
        }
        this.visiblePowerups.push(powerup);
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
        // Clear the frame
        this.ctx.fillStyle = this.settings.canvasBackground;
        this.ctx.fillRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);

        if (!this.loadingCompleted) {
            this.drawText("Loading images...", "30px Arial", "#ee3030", "center", 0, 400);
            return;
        }

        // Draw the status bar
        this.drawStatusBar();

        // Draw the paddle
        // paddleThickness/2 is also the end cap radius, so we need to subtract that from x as well
        this.ctx.drawImage(this.images["paddle_left"], this.paddle.position.x - Math.floor(this.settings.paddleThickness / 2), this.paddle.position.y - this.settings.paddleThickness / 2);
        this.ctx.drawImage(this.images["paddle_center"], this.paddle.position.x - Math.floor(this.settings.paddleThickness / 2) + 12, this.paddle.position.y - this.settings.paddleThickness / 2);
        this.ctx.drawImage(this.images["paddle_right"], this.paddle.position.x + this.paddle.width, this.paddle.position.y - this.settings.paddleThickness / 2);

        // Draw the paddle sticky effect
        if (this.paddle.sticky) {
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            this.ctx.strokeStyle = "#21c00a"; // "#45ff45";
            this.ctx.lineCap = "round";
            this.ctx.moveTo(this.paddle.position.x, this.paddle.position.y);
            this.ctx.lineTo(this.paddle.position.x + this.paddle.width, this.paddle.position.y);
            this.ctx.lineWidth = this.settings.paddleThickness;
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }

        // Draw the bricks
        for (let brick of this.bricks) {
            this.ctx.drawImage(this.images[brick.name], brick.upperLeft.x, brick.upperLeft.y, this.settings.brickWidth, this.settings.brickHeight);
        }

        // Draw powerups
        for (let powerup of this.visiblePowerups) {
            const r = this.settings.powerupImageRadius;
            const osc = 3 * Math.sin(powerup.phase);
            this.ctx.drawImage(this.images[powerup.image], powerup.position.x - r - osc/2, powerup.position.y - r, r * 2 + osc, r * 2);
        }

        // Draw the aim line
        if (this.paddle.stuckBall || this.isPowerupActive("multiball")) {
            let originX = this.paddle.position.x + this.paddle.width / 2;
            let originY = this.paddle.position.y - this.settings.ballRadius - this.settings.paddleThickness / 2 + 1;
            let targetX = originX + this.settings.aimLineLength * Math.sin(this.paddle.aimAngle);
            let targetY = originY - this.settings.aimLineLength * Math.cos(this.paddle.aimAngle);
            this.ctx.beginPath();
            this.ctx.strokeStyle = "#ff3030";
            this.ctx.setLineDash([0, 20]);
            this.ctx.lineDashOffset = this.aimDashOffset;
            this.ctx.lineCap = "round";
            this.ctx.moveTo(originX, originY);
            this.ctx.lineTo(targetX, targetY);
            this.ctx.lineWidth = 9;
            this.ctx.globalAlpha = 0.35;
            this.ctx.stroke();
            this.ctx.lineCap = "butt";
            this.ctx.globalAlpha = 1.0;
            this.ctx.setLineDash([]);
        }

        // Draw the balls
        for (let ball of this.balls) {
            if (ball.fireball) {
                // Spin the ball. (Spinning is so much cooler than not spinning!)
                this.ctx.save();
                this.ctx.translate(ball.position.x, ball.position.y);
                this.ctx.rotate(ball.rotation);
                this.ctx.translate(-ball.position.x, -ball.position.y);
                this.ctx.drawImage(this.images["fireball"], ball.position.x - this.settings.ballRadius, ball.position.y - this.settings.ballRadius);
                this.ctx.restore();
            }
            else
                this.ctx.drawImage(this.images["ball"], ball.position.x - this.settings.ballRadius, ball.position.y - this.settings.ballRadius);

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
        // Clear the status bar by drawing the background
        this.sctx.drawImage(this.images["statusbar"], 0, 0, this.settings.canvasWidth, this.settings.statusbarHeight);

        const powerupSize = 48; // Including the ring, drawn on top of the image
        const powerupSpacing = 8;

        let x = powerupSpacing;
        const y = (this.settings.statusbarHeight - powerupSize) / 2;
        for (let powerup of this.activePowerups) {
            this.sctx.drawImage(this.images[powerup.image], x, y, powerupSize, powerupSize);
            let ratio: number | undefined;
            if (powerup instanceof TimeLimitedPowerup)
                ratio = (powerup.maxTimeActive - powerup.activeTime) / powerup.maxTimeActive;
            else if (powerup instanceof RepetitionLimitedPowerup)
                ratio = (powerup.maxRepetitions - powerup.repetitions) / powerup.maxRepetitions;

            if (ratio) {
                this.sctx.beginPath();
                this.sctx.lineWidth = 3;
                this.sctx.strokeStyle = "#69d747";
                const rot = Math.PI/2;
                this.sctx.arc(x + powerupSize / 2, y + powerupSize / 2, powerupSize / 2, (2 * Math.PI) - (2 * Math.PI)*ratio - rot, 2 * Math.PI - rot);
                this.sctx.stroke();
            }

            x += powerupSize + powerupSpacing;
        }

        /*
        // Draw temporary powerup stats
        let s = "";
        for (let powerup of this.activePowerups) {
            if (powerup instanceof RepetitionLimitedPowerup)
                s += `[${powerup.name}: ${powerup.repetitions}/${powerup.maxRepetitions}] `;
            else if (powerup instanceof TimeLimitedPowerup)
                s += `[${powerup.name}: ${(powerup.activeTime/1000).toFixed(1)}/${(powerup.maxTimeActive/1000).toFixed(1)}s]`
        }
        this.drawText(s, "Arial 18 px", "black", "left", 25, 15, this.sctx);
        */

        // Draw player stats
        // TODO: Improve to use graphics
        // this.drawText(`Score: ${this.score}; ${this.livesRemaining - 1} lives remaining`, "18px Arial", "black", "left", 10, 25, this.sctx)

        // Draw the current framerate
        /*
        this.sctx.textBaseline = "middle";
        this.drawText(`FPS: ${Math.floor(this.lastFPS)}`, "18px Arial", "#ee3030", "right", this.settings.canvasWidth - 10, this.settings.statusbarHeight / 2, this.sctx);
        this.sctx.textBaseline = "alphabetic";
        */

    }
}