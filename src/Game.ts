import _ from 'lodash';
import { Settings } from './Settings';
import { Paddle } from "./Paddle";
import { Brick } from "./Brick";
import { Ball } from "./Ball";
import { Vec2 } from "./Vec2";
import { CollisionHandler } from './CollisionHandler';
import { Powerup, StickyPowerup, MultiballPowerup, TimeLimitedPowerup, RepetitionLimitedPowerup, PowerupType, FireballPowerup, ExtraLifePowerup, InstantEffectPowerup, UltrawidePowerup } from './Powerups';
import { debugAlert, formatTime, lerp } from './Utils';

function randomColor() {
    let colors = ["#38c600", "#0082f0", "#f6091f"];
    return _.sample(colors)!;
}

export class Level {
    bricks: (Brick | undefined)[][] = [];
}

let introLevel =
`..............
..............
..............
.12*456789A*C.
.12*456***A*C.
.12*456*.*A*C.
.12*456*.*A*C.
.12*456*.*A*C.
.12***6***A***
.123456789ABC.
.123456789ABC.
.123456789ABC.
.123456789ABC.
.123456789ABC.
..............
..............
..............
..............
..............
..............`;

export class Game {
    canvas: HTMLCanvasElement;
    statusbarCanvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    sctx: CanvasRenderingContext2D;
    paddle: Paddle;
    level: Level;
    balls: Ball[] = [];
    settings: Settings;
    collisionHandler: CollisionHandler;

    lastRender: number;
    lastFPS: number = 0;
    lifeLost: boolean = false;
    gameLost: boolean = false;
    gameWon: boolean = false;
    gamePaused: boolean = false;
    bricksRemaining: number = 0;

    readonly levelWidth = 14;
    readonly levelHeight = 20;

    activePowerups: Powerup[] = []; // Powerups that have been picked up and have an effect
    visiblePowerups: Powerup[] = []; // Powerups currently falling, yet to be picked up or lost
    aimDashOffset: number = 0; // Used to animate the aiming line for the sticky powerup

    loadingCompleted: boolean = false;

    totalGameTime: number = 0;
    livesRemaining: number = 0;
    score: number = 0;
    lastBrickBreak: number = 0;

    devMenuOpen: boolean = false;

    images: Record<string, HTMLImageElement> = {};

    constructor(canvas: HTMLCanvasElement, statusbarCanvas: HTMLCanvasElement, settings: Settings) {
        this.canvas = canvas;
        this.statusbarCanvas = statusbarCanvas;
        this.ctx = canvas.getContext('2d')!!;
        this.sctx = statusbarCanvas.getContext('2d')!!;

        this.level = new Level();

        this.paddle = new Paddle(settings);
        this.settings = settings;
        this.collisionHandler = new CollisionHandler(settings);

        let imageFilenames = ["brick_indestructible", "paddle_left", "paddle_center", "paddle_right",
                              "ball", "powerup_sticky", "powerup_multiball", "powerup_fireball", "powerup_extralife", "powerup_ultrawide",
                              "fireball", "statusbar", "heart", "score", "clock"];
        for (let i = 1; i <= 12; i++)
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
                alert(`Failed to load image "${name}.png"!` + (ev.message ? ` ${ev.message}` : ""));
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
            this.totalGameTime = 0;

            this.level.bricks.length = 0;
            this.initializeBricks(introLevel);
            this.bricksRemaining = _.flatten(this.level.bricks)
                                    .filter(b => b != undefined && !b.indestructible)
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

    initializeBricks(levelText: string) {
        this.level.bricks = Array(this.levelHeight).fill(undefined).map(_ => Array(this.levelWidth).fill(undefined));

        let level2D: string[][] = [];

        for (let row of levelText.split('\n')) {
            let chars = row.split('');
            if (chars.length !== this.levelWidth) {
                alert(`Invalid level: one or more lines is not exactly ${this.levelWidth} characters`);
                return;
            }
            level2D.push(chars);
        }
        if (level2D.length !== this.levelHeight) {
            alert(`Invalid level: not exactly ${this.levelHeight} lines`);
            return;
        }

        const spacing = 4;

        for (let y = 0; y < this.levelHeight; y++) {
            for (let x = 0; x < this.levelWidth; x++) {
                let xCoord = spacing + x * (this.settings.brickWidth + (x > 0 ? spacing : 0));
                let yCoord = spacing + y * (this.settings.brickHeight + (y > 0 ? spacing : 0));
                let c = level2D[y][x];
                let num = parseInt(c, 16);
                if (!isNaN(num)) {
                    this.level.bricks[y][x] = new Brick(new Vec2(xCoord, yCoord), `brick${num}`, this.settings, 10, 1);
                }
                else if (c === '*') {
                    this.level.bricks[y][x] = new Brick(new Vec2(xCoord, yCoord), `brick_indestructible`, this.settings, 10, 1, true);
                }
            }
        }
    }

    mouseMoved(e: MouseEvent) {
        if (!this.gamePaused && !this.gameLost && !this.gameWon && !this.lifeLost)
            this.paddle.move(e.movementX, this.shouldDrawAimLine() ? e.movementY : 0);
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
        else if (ev.key == "a" || ev.key == "A") {
            this.devMenuOpen = !this.devMenuOpen;
            return;
        }

        if (this.devMenuOpen) {
            if (!["1", "2", "3", "4", "5"].includes(ev.key))
                return;

            let powerup: Powerup;
            if (ev.key === "1") powerup = this.createPowerup("sticky");
            else if (ev.key === "2") powerup = this.createPowerup("ultrawide");
            else if (ev.key === "3") powerup = this.createPowerup("multiball");
            else if (ev.key === "4") powerup = this.createPowerup("fireball");
            else if (ev.key === "5") powerup = this.createPowerup("extralife");
            else throw new Error("Quiet, compiler! (One of the above is ALWAYS true due to the prior above)");

            let existingPowerup = this.getPowerup(powerup.type);
            if (existingPowerup)
                existingPowerup.addInstance();
            else {
                powerup.activate();
                if (!(powerup instanceof InstantEffectPowerup))
                    this.activePowerups.push(powerup);
            }

            this.devMenuOpen = false;
        }
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

        if (!this.gameLost)
            this.totalGameTime += dt;

        // Animate the aiming line (if visible)
        this.aimDashOffset -= 0.07 * dt;

        this.checkPowerupExpiry(dt);
        this.animateFallingPowerups(dt);
        this.updateBallPositions(dt);

        this.animateUltrawideTransition(dt);

        // Used for ball-paddle and powerup-paddle collisions, below
        const paddleTopY = this.paddle.position.y - this.settings.paddleThickness / 2;
        const paddleLeftmostX = this.paddle.position.x - this.paddle.width / 2;
        const paddleRightmostX = this.paddle.position.x + + this.paddle.width / 2;

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

    animateUltrawideTransition(dt: number) {
        let isActive = this.isPowerupActive("ultrawide");
        if ((!isActive && this.paddle.width == this.paddle.defaultWidth) ||
            (isActive && this.paddle.width == this.paddle.ultrawideWidth)) {
            return;
        }

        this.paddle.ultrawideTransitionTime += dt;

        const totalTransitionTime = 500;
        let prevWidth = isActive ? this.paddle.defaultWidth : this.paddle.ultrawideWidth;
        let targetWidth = isActive ? this.paddle.ultrawideWidth : this.paddle.defaultWidth;
        this.paddle.width = lerp(prevWidth, targetWidth, this.paddle.ultrawideTransitionTime / totalTransitionTime);
        this.paddle.clampPosition();
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
                this.paddle.setStuckBall(ball, false);
                ball.velocity.x = 0;
                ball.velocity.y = 0;

                (this.getPowerup("sticky") as StickyPowerup)?.trigger();
            }
            else {
                // Bounce angle depends on where the ball hits.
                // First calculate the hit location (between 0 and 1, 0 being the leftmost point of the paddle),
                // then calculate the bounce angle based on that location (0.5 = straight up),
                // then calculate the velocity components based on the previous velocity magnitude and the bounce angle.
                const hitLocation = (ball.position.x - paddleLeftmostX) / this.paddle.width;
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
        for (let y = 0; y < this.levelHeight; y++) {
            for (let x = 0; x < this.levelWidth; x++) {
                let brick = this.level.bricks[y][x];
                if (brick === undefined) continue;

                if (!this.collisionHandler.brickCollision(ball, brick, dt))
                    continue;

                ball.collided = true;

                if (!brick.indestructible && !ball.fireball)
                    brick.health--;
                else if (!brick.indestructible && ball.fireball)
                    brick.health = 0;

                if (brick.health <= 0) {
                    let delta = (Date.now() - this.lastBrickBreak) / 1000;

                    let multiplier = 1;
                    if (delta < 0.1)
                        multiplier = 1.3; // Likely fireball
                    else if (delta < 0.35)
                        multiplier = 1.5; // E.g. tight bouncing between top and bricks
                    else if (delta < 1.2)
                        multiplier = 1.2; // Standard bouncing paddle-brick-paddle-brick

                    this.score += Math.floor(multiplier * brick.score);
                    this.level.bricks[y][x] = undefined;
                    this.bricksRemaining--;

                    if (_.random(1, 100) <= this.settings.powerupProbability) {
                        let spawnPosition = new Vec2(brick.bottomLeft.x + this.settings.brickWidth / 2, brick.upperLeft.y + this.settings.brickHeight / 2);
                        this.spawnRandomPowerup(spawnPosition);
                    }

                    this.lastBrickBreak = Date.now();
                }

                if (this.bricksRemaining <= 0)
                    this.win();

                break; // Limit collisions to the first block tested
            }
        }
    }

    private handlePowerupPickups(paddleTopY: number, paddleLeftmostX: number, paddleRightmostX: number) {
        const r = this.settings.powerupImageRadius;
        for (let i = this.visiblePowerups.length - 1; i >= 0; i--) {
            let powerup = this.visiblePowerups[i];

            if (powerup.position.y + r >= paddleTopY &&
                powerup.position.x + r >= paddleLeftmostX &&
                powerup.position.x - r <= paddleRightmostX &&
                powerup.position.y - r < this.paddle.position.y &&
                !this.gameLost &&
                !this.lifeLost) {
                let existingPowerup = this.getPowerup(powerup.type);
                this.score += powerup.pickupScore;
                if (existingPowerup)
                    existingPowerup.addInstance();
                else {
                    powerup.activate();
                    if (!(powerup instanceof InstantEffectPowerup))
                        this.activePowerups.push(powerup);
                }

                this.visiblePowerups.splice(i, 1);
                // TODO: animate the disappearance
            }
        }
    }

    private checkPowerupExpiry(dt: number) {
        for (let p of this.activePowerups) {
            if (p instanceof TimeLimitedPowerup) {
                if (!(this.balls.length === 1 && this.paddle.stuckBall))
                    p.tick(dt); // TODO: Ensure we want the same behaviour for all powerups! Right now this is just fireball
            }
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
        let rand = _.random(0, 4);

        // TODO: have separate probabilities for each powerup in the future!
        if (rand == 0)
            powerup = this.createPowerup("sticky", spawnPosition);
        else if (rand == 1)
            powerup = this.createPowerup("multiball", spawnPosition);
        else if (rand == 2)
            powerup = this.createPowerup("fireball", spawnPosition);
        else if (rand == 3)
            powerup = this.createPowerup("extralife", spawnPosition);
        else
            powerup = this.createPowerup("ultrawide", spawnPosition);

        this.visiblePowerups.push(powerup);
    }

    createPowerup(type: PowerupType, spawnPosition = new Vec2(0, 0)) {
        let powerup: Powerup;
        if (type === "sticky") {
            powerup = new StickyPowerup(spawnPosition);
            powerup.setActivatedCallback(() => {
                this.paddle.sticky++;
            });
            powerup.setDeactivatedCallback(() => {
                this.paddle.sticky--;
            });
        }
        else if (type === "multiball") {
            powerup = new MultiballPowerup(spawnPosition);
        }
        else if (type === "fireball") {
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
        else if (type === "extralife") {
            powerup = new ExtraLifePowerup(spawnPosition);
            powerup.setActivatedCallback(() => {
                this.livesRemaining += 1;
                // TODO: play sound
            })
        }
        else if (type === "ultrawide") {
            powerup = new UltrawidePowerup(spawnPosition);
            powerup.setActivatedCallback(() => {
                this.paddle.ultrawideTransitionTime = 0;
                this.paddle.ultrawide = true;
            });
            powerup.setDeactivatedCallback(() => {
                this.paddle.ultrawideTransitionTime = 0;
                this.paddle.ultrawide = false;
            });
        }
        else
            throw new Error("Invalid powerup type passed to createPowerup");

        return powerup;
    }

    gameLoop(timestamp: number) {
        var dt = timestamp - this.lastRender

        this.update(dt)
        this.drawFrame()

        this.lastRender = timestamp
        this.lastFPS = 1000/dt;
        window.requestAnimationFrame((dt) => this.gameLoop(dt));
    }

    shouldDrawAimLine() {
        return this.paddle.stuckBall || this.isPowerupActive("multiball");
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
        const leftCapWidth = this.images["paddle_left"].width;
        const rightCapWidth = this.images["paddle_right"].width;
        this.ctx.drawImage(this.images["paddle_left"], this.paddle.position.x - Math.floor(this.paddle.width / 2), this.paddle.position.y - this.settings.paddleThickness / 2);
        this.ctx.drawImage(this.images["paddle_center"], this.paddle.position.x - Math.ceil(this.paddle.width / 2) + leftCapWidth,
                                                         this.paddle.position.y - this.settings.paddleThickness / 2,
                                                         this.paddle.width - leftCapWidth - rightCapWidth,
                                                         this.settings.paddleThickness);
        this.ctx.drawImage(this.images["paddle_right"], this.paddle.position.x + Math.floor(this.paddle.width / 2) - rightCapWidth - 1, this.paddle.position.y - this.settings.paddleThickness / 2);

        // Draw the paddle sticky effect
        if (this.paddle.sticky) {
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            this.ctx.strokeStyle = "#21c00a"; // "#45ff45";
            this.ctx.lineCap = "round";
            const lineCapWidth = this.settings.paddleThickness / 2;
            this.ctx.moveTo(this.paddle.position.x - this.paddle.width / 2 + lineCapWidth, this.paddle.position.y);
            this.ctx.lineTo(this.paddle.position.x + this.paddle.width / 2 - lineCapWidth, this.paddle.position.y);
            this.ctx.lineWidth = this.settings.paddleThickness;
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }

        // Draw the bricks
        for (let brick of _.flatten(this.level.bricks)) {
            if (brick === undefined)
                continue;
            this.ctx.drawImage(this.images[brick.name], brick.upperLeft.x, brick.upperLeft.y, this.settings.brickWidth, this.settings.brickHeight);
        }

        // Draw powerups
        for (let powerup of this.visiblePowerups) {
            const r = this.settings.powerupImageRadius;
            const osc = 3 * Math.sin(powerup.phase);
            this.ctx.drawImage(this.images[powerup.image], powerup.position.x - r - osc/2, powerup.position.y - r, r * 2 + osc, r * 2);
        }

        // Draw the aim line
        if (this.shouldDrawAimLine()) {
            let originX = this.paddle.stuckBall ? this.paddle.stuckBall.position.x : this.paddle.position.x;
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

        if (this.devMenuOpen) {
            this.drawText("1  Sticky", "20px Arial", "black", "left", 10, 500);
            this.drawText("2  Ultrawide", "20px Arial", "black", "left", 10, 520);
            this.drawText("3  Multiball", "20px Arial", "black", "left", 10, 540);
            this.drawText("4  Fireball", "20px Arial", "black", "left", 10, 560);
            this.drawText("5  Extra life", "20px Arial", "black", "left", 10, 580);
            this.drawText("A  Close menu", "20px Arial", "black", "left", 10, 600);
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

        this.sctx.textBaseline = "middle";

        const powerupSize = 36; // Including the ring, drawn on top of the image
        const powerupSpacing = 8;
        const iconTextSpacing = 8;

        const textColor = "#281f17";
        const fontSize = 20;
        const fontName = "Arial";
        const charWidth = 12;
        const textY = this.settings.statusbarHeight / 2;

        const iconSize = 24;
        const iconY = (this.settings.statusbarHeight - iconSize) / 2;

        let x = powerupSpacing;

        // Draw the number of lives remaining
        this.sctx.drawImage(this.images["heart"], x, iconY);
        x += iconSize + iconTextSpacing;
        let lives;
        let width;
        if (this.livesRemaining >= 1) {
            lives = (this.livesRemaining - 1).toString();
            width = lives.length;
        }
        else {
            lives = "🕱";
            width = 1;
        }
        this.drawText(lives, `${fontSize}px ${fontName}`, textColor, "left", x, textY, this.sctx);
        x += 4 + iconTextSpacing + width * charWidth;

        // Draw the total time taken
        this.sctx.drawImage(this.images["clock"], x, iconY);
        x += iconSize + iconTextSpacing - 2;
        let time = formatTime(Math.floor(this.totalGameTime / 1000));
        this.drawText(time, `${fontSize}px ${fontName}`, textColor, "left", x, textY, this.sctx);
        x += iconTextSpacing + time.length * charWidth - 3;

        // Draw the score
        this.sctx.drawImage(this.images["score"], x, iconY);
        x += iconSize + iconTextSpacing + 2;
        this.drawText(this.score.toString(), `${fontSize}px ${fontName}`, textColor, "left", x, textY, this.sctx);
        x += 4 + iconTextSpacing + this.score.toString().length * charWidth;

        // Draw active powerups
        x -= 2;
        const y = (this.settings.statusbarHeight - powerupSize) / 2;
        for (let powerup of this.activePowerups) {
            let draw = true;
            let drawRed = false;

            if (powerup instanceof TimeLimitedPowerup) {
                // Blink when the time is running out
                const remaining = powerup.maxTimeActive - powerup.activeTime;
                if ((remaining < 1000 && remaining >= 750) || (remaining < 500 && remaining >= 250))
                    draw = false;
                if (remaining < powerup.originalMaxTimeActive / 5 || remaining < 1500)
                    drawRed = true;
            }
            else if (powerup instanceof RepetitionLimitedPowerup && (powerup.maxRepetitions - powerup.repetitions) <= 1)
                drawRed = true;

            if (draw)
                this.sctx.drawImage(this.images[powerup.image], x, y, powerupSize, powerupSize);

            let ratio: number | undefined;
            if (powerup instanceof TimeLimitedPowerup)
                ratio = (powerup.maxTimeActive - powerup.activeTime) / powerup.maxTimeActive;
            else if (powerup instanceof RepetitionLimitedPowerup)
                ratio = (powerup.maxRepetitions - powerup.repetitions) / powerup.maxRepetitions;

            if (ratio && draw) {
                this.sctx.beginPath();
                this.sctx.lineWidth = 3;
                this.sctx.strokeStyle = drawRed ? "#ff2020" : "#69d747";
                const rot = Math.PI/2;
                this.sctx.arc(x + powerupSize / 2, y + powerupSize / 2, powerupSize / 2, (2 * Math.PI) - (2 * Math.PI)*ratio - rot, 2 * Math.PI - rot);
                this.sctx.stroke();
            }

            x += powerupSize + powerupSpacing;
        }

        // Draw the current framerate
        /*
        this.sctx.textBaseline = "middle";
        this.drawText(`FPS: ${Math.floor(this.lastFPS)}`, "18px Arial", "#ee3030", "right", this.settings.canvasWidth - 10, this.settings.statusbarHeight / 2, this.sctx);
        this.sctx.textBaseline = "alphabetic";
        */
    }
}
