import _ from 'lodash';
import { Ball } from "./Ball";
import { Brick, BrickOrEmpty } from "./Brick";
import { CollisionFrom, CollisionHandler } from './CollisionHandler';
import { DrawingHandler } from './DrawingHandler';
import { Editor } from './Editor';
import { Paddle } from "./Paddle";
import { ExtraLifePowerup, FireballPowerup, InstantEffectPowerup, MultiballPowerup, Powerup, PowerupType, StickyPowerup, TimeLimitedPowerup, UltrawidePowerup } from './Powerups';
import { Settings } from './Settings';
import { LevelSelector } from './UI/LevelSelector';
import { clearBrickArray, copyBrickArray, createLoadingScreen, debugAlert, fetchLevelIndex, generateEmptyBrickArray, generateLevelTextFromBricks, lerp, LevelMetadata, loadBricksFromLevelText, Mode, notifyWithButton } from './Utils';
import { Vec2 } from "./Vec2";
import { Window, WindowManager } from './WindowManager';

export class LevelTemp {
    bricks: BrickOrEmpty[][] = [];
}

export class Game implements Window {
    canvas: HTMLCanvasElement;
    statusbarCanvas: HTMLCanvasElement;
    helpElement: HTMLHeadingElement;
    paddle: Paddle;
    level: LevelTemp;
    balls: Ball[] = [];
    settings: Settings;
    collisionHandler: CollisionHandler;

    readonly GAME_HELP_TEXT = "Move the mouse to control the paddle. Click to launch. Press P to pause.<br>Ctrl+E to enter the level editor.";
    readonly EDITOR_HELP_TEXT = "Left-click to place bricks, right-click to remove.<br>Shift+click to select bricks, alt+click to deselect. Ctrl+A to select all, Ctrl+D deselect all. Del to delete selected.<br>Click+drag a selected brick to move the selected bricks; hold ctrl to copy.";

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
    levelSelector: LevelSelector | null = null;

    totalGameTime: number = 0;
    livesRemaining: number = 0;
    score: number = 0;
    lastBrickBreak: number = 0;

    mouseDownSeen: boolean = false;
    devMenuOpen: boolean = false;

    drawingHandler: DrawingHandler;
    windowManager: WindowManager;

    // Required by Window
    acceptsInput = true;
    ignoresInput = false;

    // Specify the cursor shouldn't move while Game is active
    cursorFrozen = true;

    currentMode: Mode = "game";
    editor: Editor;

    constructor(canvas: HTMLCanvasElement, statusbarCanvas: HTMLCanvasElement, settings: Settings) {
        this.settings = settings;
        this.canvas = canvas;
        this.statusbarCanvas = statusbarCanvas;
        this.helpElement = document.getElementById("helptext")! as HTMLHeadingElement;
        this.helpElement.innerHTML = this.GAME_HELP_TEXT;

        this.windowManager = WindowManager.getInstance();
        this.windowManager.addWindow(this);
        this.editor = new Editor(this, settings);
        this.windowManager.addWindow(this.editor);
        this.windowManager.setActiveWindow(this);

        this.drawingHandler = new DrawingHandler(this, this.editor, canvas, statusbarCanvas, settings, () => {
            this.imageLoadingCompleted = true;
            if (this.levelLoadingCompleted) {
                this.loadingCompleted = true;
            }
        });

        this.level = new LevelTemp();

        this.paddle = new Paddle(settings);
        this.collisionHandler = new CollisionHandler(settings);

        this.showLoadDialog();

        window.requestAnimationFrame((dt) => this.mainLoop(dt));
        this.lastRender = 0;
    }


    reset(forceFullReset: boolean = false) {
        // If the game is still active and lives remain, we do a partial reset.
        // Otherwise, reset everything -- i.e. restart the game entirely.

        if (!this.levelText)
            debugAlert("Reset called with levelText undefined");

        let partialReset = !forceFullReset && !this.gameLost && !this.gameWon && this.livesRemaining > 0;

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
            this.level.bricks = generateEmptyBrickArray(this.settings);
            if (!loadBricksFromLevelText(this.levelText!, this.level.bricks, this.settings)) {
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

    showLoadDialog() {
        // Set up callbacks first...
        const loadCallback = (selectedLevel: LevelMetadata | string) => {
            // Should never, ever happen for loading, but the compiler doesn't realize that.
            if (typeof selectedLevel === "string") return;

            this.windowManager.removeWindow(this.levelSelector);
            this.levelSelector = null;
            this.levelText = selectedLevel.leveltext;

            this.levelLoadingCompleted = true;
            if (this.imageLoadingCompleted) {
                this.loadingCompleted = true;
                this.reset();
            }
        };
        const cancelCallback = () => {
            this.windowManager.removeWindow(this.levelSelector);
            this.levelSelector = null;
        };

        createLoadingScreen("Loading level list...", this.settings);

        fetchLevelIndex("standalone", this.settings, (levels: LevelMetadata[]) => {
            // Success callback
            this.windowManager.removeLoadingScreen();
            this.levelSelector = new LevelSelector("load", levels, null, this.settings, loadCallback, cancelCallback, false);
            this.windowManager.addWindow(this.levelSelector, true);
        }, () => {
            // Failure callback
            this.windowManager.removeLoadingScreen();
        });
    }

    win() {
        this.gameWon = true;
    }

    mouseMoved(e: MouseEvent) {
        if (!this.gamePaused && !this.gameLost && !this.gameWon && !this.lifeLost)
            this.paddle.move(e.movementX, this.shouldDrawAimLine() ? e.movementY : 0);
    }

    onmousedown(e: MouseEvent) {
        if (e.button !== 0)
            return;

        this.mouseDownSeen = true;
    }

    onmouseup(e: MouseEvent) {
        // Bit of a hack... If you click "Load" in the load dialog, the mouseup usually ends up back here, and so the game starts instantly on load.
        if (!this.mouseDownSeen)
            return;
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
            else throw new Error("Quiet, compiler! (One of the above is ALWAYS true due to the return above)");

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
    }

    enterEditor() {
        this.pause();
        this.currentMode = "editor";
        this.statusbarCanvas.style.display = "none";
        this.canvas.style.borderBottom = "2px solid black";
        this.helpElement.innerHTML = this.EDITOR_HELP_TEXT;
        this.canvas.width = this.settings.canvasWidth + this.settings.editorToolbarWidth;

        this.windowManager.setActiveWindow(this.editor);
        this.windowManager.setMaxWidth(this.settings.canvasWidth + this.settings.editorToolbarWidth);

        this.editor.testLogin();
    }

    exitEditor() {
        this.currentMode = "game";
        this.statusbarCanvas.style.display = "block";
        this.canvas.style.borderBottom = "none";
        this.helpElement.innerHTML = this.GAME_HELP_TEXT;
        this.canvas.width = this.settings.canvasWidth;

        this.windowManager.setActiveWindow(this);
        this.windowManager.setMaxWidth(this.settings.canvasWidth);

        if (this.editor.playTestMode) {
            console.log("Playtest mode active, copying bricks");
            this.levelText = generateLevelTextFromBricks(this.editor.bricks, this.settings);
            this.reset(true);
        }
    }

    togglePause() {
        // Ignore unpause requests if the game isn't focused; otherwise, it's likely the player will unpause, realize the mouse won't work,
        // and lose a life.
        if (this.gamePaused && document.pointerLockElement !== this.canvas)
            return;

        this.gamePaused = !this.gamePaused;
    }
    pause() { this.gamePaused = true; }

    focusLost() {
        this.mouseDownSeen = false;

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

    collideWithBrickAt(x: number, y: number, ball: Ball) {
        let brick = this.level.bricks[y][x];
        if (brick === undefined) return;

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
                let spawnPosition = new Vec2(brick.center);
                this.spawnRandomPowerup(spawnPosition);
            }

            this.lastBrickBreak = Date.now();
        }

        if (this.bricksRemaining <= 0)
            this.win();
    }

    handleBrickCollisions(ball: Ball, dt: number) {

        // Find which bricks the ball is colliding with.
        // If there are multiple, we'll choose the one that will cause the least amount of issues.
        let intersectingBricks = this.collisionHandler.findIntersectingBricks(this.level.bricks, ball);

        if (intersectingBricks.length === 0)
            return;

        // There is at least one collision. Move the ball back and interpolate until we have a collision again.
        // This will reduce the number of 2-brick collisions, meaning we no longer need to figure out which it collided with first.
        // Perhaps more importantly, it will also make the collision direction calculation more accurate.

        ball.position.x -= ball.velocity.x * dt;
        ball.position.y -= ball.velocity.y * dt;

        do {
            ball.position.x += ball.velocity.x * dt * 0.1;
            ball.position.y += ball.velocity.y * dt * 0.1;
            intersectingBricks = this.collisionHandler.findIntersectingBricks(this.level.bricks, ball);
        } while (intersectingBricks.length === 0);

        // Select the brick that we collided with. In most cases this will select the ONLY brick, but
        // in rare cases we may have collided with multiple at the same time.
        let intersection;
        if (intersectingBricks.length === 2) {
            /*
            We can't just pick a random brick here.
            Major issues result if we pick the wrong one (see collision_bug_explanation.png if it still exists).
            In short, the ball can end up such that it:
            1) Intersects the side of two bricks at the same time
            2) Is located above (or below) both collision test lines (the diagonals used in isAboveLine()) for one of the bricks.

            In such a case, it can happen that it is placed such that the collision code detects ONE of them as left,
            and the other as from ABOVE or BELOW. In that case, we need to choose the one that is LEFT, or the ball will be
            reflected incorrectly, and collide with the other brick the next frame, which reflects in along both axes, returning
            the ball along the exact opposite of the velocity vector that it had to begin with.
            We only want it to bounce back towards the LEFT in this example, and NOT have its y velocity flipped as well.

            In this example, if we check the collision direction on the BOTTOM block, it will return "from above", and reflect incorrectly.
            So in this case, we need to treat this as a collision with the UPPER block, with the collisino being from the LEFT,
            even though it intersects both.
            */

            const [a, b] = [intersectingBricks[0], intersectingBricks[1]];
            if (a.x === b.x && Math.abs(a.y - b.y) === 1) {
                // Uh oh!
                const aDir = this.collisionHandler.collisionDirection(ball, a.brick);
                const bDir = this.collisionHandler.collisionDirection(ball, b.brick);
                const aHorizontal = (aDir === CollisionFrom.Left || aDir === CollisionFrom.Right);
                const bHorizontal = (bDir === CollisionFrom.Left || bDir === CollisionFrom.Right);

                if (aHorizontal && !bHorizontal)
                    intersection = a;
                else if (bHorizontal && !aHorizontal)
                    intersection = b;
                else // It shouldn't be important which is chosen here, we just need to pick one
                    intersection = a;
            }
            else {
                // Not an important case; either choice should be perfectly fine, so just pick the first one.
                intersection = intersectingBricks[0];
            }
        }
        else {
            // Almost every time, this is exactly 1 brick intersecting. However, it could be 3.
            // Those cases are extremely rare, AND should be handled correctly *every* time by interpolating the ball position
            // as done above, so we probably don't need to worry about it here.
            intersection = intersectingBricks[0];
        }

        ball.collided = true;
        this.collideWithBrickAt(intersection.x, intersection.y, ball);
        this.collisionHandler.brickCollision(ball, intersection.brick, dt);
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
