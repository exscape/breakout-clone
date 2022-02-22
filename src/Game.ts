import _ from 'lodash';
import { Settings } from './Settings';
import { Paddle } from "./Paddle";
import { Brick, BrickOrEmpty } from "./Brick";
import { Ball } from "./Ball";
import { Vec2 } from "./Vec2";
import { CollisionHandler } from './CollisionHandler';
import { DrawingHandler } from './DrawingHandler';
import { Powerup, StickyPowerup, MultiballPowerup, TimeLimitedPowerup, RepetitionLimitedPowerup, PowerupType, FireballPowerup, ExtraLifePowerup, InstantEffectPowerup, UltrawidePowerup } from './Powerups';
import { debugAlert, drawCoordsFromBrickCoords, lerp } from './Utils';
import { Editor } from './Editor';

export class Level {
    bricks: BrickOrEmpty[][] = [];
}

type LevelType = "campaign" | "standalone";
type LevelMetadata = { level_id: number, name: string, type: LevelType, levelnumber: number, filename: string, author: string };
type LevelIndexResult = { "campaign": LevelMetadata[], "standalone": LevelMetadata[] };
type Mode = "game" | "editor";

export class Game {
    canvas: HTMLCanvasElement;
    statusbarCanvas: HTMLCanvasElement;
    helpElement: HTMLHeadingElement;
    paddle: Paddle;
    level: Level;
    balls: Ball[] = [];
    settings: Settings;
    collisionHandler: CollisionHandler;

    readonly GAME_HELP_TEXT = "Move the mouse to control the paddle. Click to launch. Press P to pause.";
    readonly EDITOR_HELP_TEXT = "Left-click to place bricks, right-click to remove.<br>Shift+click to select bricks, alt+click to deselect.<br>Click+drag a selected brick to move the selected bricks; hold ctrl to copy.";

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

    levelLoadingCompleted: boolean = false;
    imageLoadingCompleted: boolean = false;
    loadingCompleted: boolean = false;
    loadingFailed: boolean = false;

    levelText: string | undefined;

    totalGameTime: number = 0;
    livesRemaining: number = 0;
    score: number = 0;
    lastBrickBreak: number = 0;

    devMenuOpen: boolean = false;

    drawingHandler: DrawingHandler;

    currentMode: Mode = "game";
    editor: Editor;

    constructor(canvas: HTMLCanvasElement, statusbarCanvas: HTMLCanvasElement, settings: Settings) {
        this.settings = settings;
        this.canvas = canvas;
        this.statusbarCanvas = statusbarCanvas;
        this.helpElement = document.getElementById("helptext")! as HTMLHeadingElement;

        this.drawingHandler = new DrawingHandler(this, canvas, statusbarCanvas, settings, () => {
            this.imageLoadingCompleted = true;
            if (this.levelLoadingCompleted) {
                this.loadingCompleted = true;
                this.init();
            }
        });

        this.level = new Level();

        this.paddle = new Paddle(settings);
        this.collisionHandler = new CollisionHandler(settings);

        this.fetchLevelIndex();

        this.editor = new Editor(this, settings);

        this.lastRender = 0;
    }

    init() {
        this.reset();
        window.requestAnimationFrame((dt) => this.mainLoop(dt));
    }

    reset() {
        // If the game is still active and lives remain, we do a partial reset.
        // Otherwise, reset everything -- i.e. restart the game entirely.

        if (!this.levelText)
            alert("Reset called with lastLevel undefined");

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
            this.level.bricks = Array(this.settings.levelHeight).fill(undefined).map(_ => Array(this.settings.levelWidth).fill(undefined));
            if (!this.loadLevel(this.levelText!!, this.level.bricks)) {
                this.loadingCompleted = false;
                this.loadingFailed = true;
            }
            this.bricksRemaining = _.flatten(this.level.bricks)
                                    .filter(b => b != undefined && !b.indestructible)
                                    .length;
            this.livesRemaining = 3;
            this.score = 0;
        }

        let ball = new Ball(new Vec2(), new Vec2());
        this.balls.push(ball);
        this.paddle.setStuckBall(ball);
    }

    fetchLevelIndex() {
        fetch('/game/level_index.php', {
                method: "GET",
                cache: 'no-cache'
        })
        .then(response => response.json())
        .then(json => {
            // Fetch the campaign level with the lowest levelnumber
            if ("type" in json && json.type === "error") {
                alert("Failed to read level index: " + json.error);
                return;
            }
            else if (!("result" in json)) {
                alert("Invalid answer from server");
                return;
            }

            let metadataArray = json.result as LevelIndexResult;

            if (metadataArray.campaign.length <= 0) {
                alert("No campaign levels found in level index!");
                return;
            }

            let firstLevel = metadataArray.campaign[0];
            this.fetchLevel(`levels/${firstLevel.filename}`);
        })
        .catch(error => {
            alert("Failed to download level index: " + error);
        });
    }

    fetchLevel(path: string) {
        fetch(`/game/${path}`, {
                method: "GET",
                cache: 'no-cache'
        })
        .then(response => {
            if (response.ok)
                return response.text()
            else
                throw new Error("HTTP error (this is probably a bug, though!)");
        })
        .then(text => {
            this.levelLoadingCompleted = true;
            this.levelText = text;
            if (this.imageLoadingCompleted) {
                this.loadingCompleted = true;
                this.init();
            }
        })
        .catch(error => {
            alert("Failed to download level index: " + error);
        });
    }

    win() {
        this.gameWon = true;
    }

    loadLevel(levelText: string, target: BrickOrEmpty[][]): boolean {
        let level2D: string[][] = [];

        let count = 0;
        for (let row of levelText.split('\n')) {
            count++;
            if (count > this.settings.levelHeight)
                break;

            let chars = row.split('');
            if (chars.length !== this.settings.levelWidth) {
                alert(`Invalid level: one or more lines is not exactly ${this.settings.levelWidth} characters`);
                return false;
            }
            level2D.push(chars);
        }
        if (level2D.length !== this.settings.levelHeight) {
            alert(`Invalid level: not exactly ${this.settings.levelHeight} lines`);
            return false;
        }

        for (let y = 0; y < this.settings.levelHeight; y++) {
            for (let x = 0; x < this.settings.levelWidth; x++) {
                let xCoord = drawCoordsFromBrickCoords("x", x, this.settings);
                let yCoord = drawCoordsFromBrickCoords("y", y, this.settings);
                let c = level2D[y][x];
                let num = parseInt(c, 16);
                if (!isNaN(num)) {
                    target[y][x] = new Brick(new Vec2(xCoord, yCoord), `brick${num}`, this.settings, 10, 1);
                }
                else if (c === '*') {
                    target[y][x] = new Brick(new Vec2(xCoord, yCoord), `brick_indestructible`, this.settings, 10, 1, true);
                }
            }
        }

        return true;
    }

    mouseMoved(e: MouseEvent) {
        if (this.currentMode === "editor") {
            this.editor.mouseMoved(e);
            return;
        }

        if (!this.gamePaused && !this.gameLost && !this.gameWon && !this.lifeLost)
            this.paddle.move(e.movementX, this.shouldDrawAimLine() ? e.movementY : 0);
    }

    onmousedown(e: MouseEvent) {
        if (this.currentMode === "editor") {
            this.editor.onmousedown(e);
            return;
        }

        if (e.button !== 0)
            return;
    }

    onmouseup(e: MouseEvent) {
        if (this.currentMode === "editor") {
            this.editor.onmouseup(e);
            return;
        }

        if (e.button !== 0)
            return;

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

        let newBall = new Ball(new Vec2(), new Vec2());

        if (this.isPowerupActive("fireball"))
            newBall.fireball = true;

        this.balls.push(newBall);
        this.paddle.setStuckBall(newBall);
        this.paddle.launch();

        (this.getPowerup("multiball") as MultiballPowerup)?.trigger();

        return true;
    }

    keyDown(ev: KeyboardEvent) {
        if (this.currentMode === "editor") {
            this.editor.keyDown(ev);
            return;
        }

        if (ev.key == "p" || ev.key == "P")
            this.togglePause();
        else if (ev.key == "a" || ev.key == "A") {
            this.devMenuOpen = !this.devMenuOpen;
            return;
        }
        else if (ev.ctrlKey && (ev.key == "e" || ev.key == "E" )) {
            ev.preventDefault();
            this.enterEditor();
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

    keyUp(ev: KeyboardEvent) {
        if (this.currentMode === "editor") {
            this.editor.keyUp(ev);
            return;
        }
    }

    enterEditor() {
        this.pause();
        this.currentMode = "editor";
        this.statusbarCanvas.style.display = "none";
        this.canvas.style.borderBottom = "2px solid black";
        this.helpElement.innerHTML = this.EDITOR_HELP_TEXT;

        this.canvas.width = this.settings.canvasWidth + this.settings.editorToolbarWidth;
    }

    exitEditor() {
        this.currentMode = "game";
        this.statusbarCanvas.style.display = "block";
        this.canvas.style.borderBottom = "none";
        this.helpElement.innerHTML = this.GAME_HELP_TEXT;
        this.canvas.width = this.settings.canvasWidth;
    }

    togglePause() { this.gamePaused = !this.gamePaused; }
    pause() { this.gamePaused = true; }

    focusLost() {
        if (this.currentMode === "editor") {
            this.editor.focusLost();
            return;
        }

        if (!this.gameWon && !this.gameLost)
            this.pause();
    }

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
        if (this.currentMode === "editor")
            return;

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
        for (let y = 0; y < this.settings.levelHeight; y++) {
            for (let x = 0; x < this.settings.levelWidth; x++) {
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

    mainLoop(timestamp: number) {
        var dt = timestamp - this.lastRender

        this.update(dt)
        if (this.currentMode === "game")
            this.drawingHandler.drawGameFrame();
        else
            this.drawingHandler.drawEditorFrame();

        this.lastRender = timestamp
        this.lastFPS = 1000/dt;
        window.requestAnimationFrame((dt) => this.mainLoop(dt));
    }

    shouldDrawAimLine() {
        return this.paddle.stuckBall || this.isPowerupActive("multiball");
    }
}
