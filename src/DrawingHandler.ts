import _ from "lodash";
import { Game } from "./Game";
import { RepetitionLimitedPowerup, TimeLimitedPowerup } from "./Powerups";
import { Settings } from "./Settings";
import { brickCoordsFromDrawCoords, drawCoordsFromBrickCoords, formatTime } from "./Utils";
import { Vec2 } from "./Vec2";

export class DrawingHandler {
    canvas: HTMLCanvasElement;
    statusbarCanvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    sctx: CanvasRenderingContext2D;
    settings: Settings;
    game: Game;

    images: Record<string, HTMLImageElement> = {};

    constructor(game: Game, canvas: HTMLCanvasElement, statusbarCanvas: HTMLCanvasElement, settings: Settings, imagesLoadedCallback: () => void) {
        this.game = game;
        this.canvas = canvas;
        this.statusbarCanvas = statusbarCanvas;
        this.ctx = canvas.getContext('2d')!!;
        this.sctx = statusbarCanvas.getContext('2d')!!
        this.settings = settings;

        let imageFilenames = ["brick_indestructible", "paddle_left", "paddle_center", "paddle_right",
                              "ball", "powerup_sticky", "powerup_multiball", "powerup_fireball", "powerup_extralife", "powerup_ultrawide",
                              "fireball", "statusbar", "heart", "score", "clock", "mouse_pointer", "brick_delete"];
        for (let i = 1; i <= 12; i++)
            imageFilenames.push(`brick${i}`);

        for (let name of imageFilenames) {
            var img = new Image();
            let self = this;
            img.addEventListener('load', function () {
                self.images[name] = this;
                if (Object.keys(self.images).length == imageFilenames.length) {
                    imagesLoadedCallback();
                }
            });
            img.addEventListener('error', (ev: ErrorEvent) => {
                alert(`Failed to load image "${name}.png"!` + (ev.message ? ` ${ev.message}` : ""));
            });
            img.src = `img/${name}.png`;
        }

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

    drawGameFrame() {
        // Clear the frame
        this.ctx.fillStyle = this.settings.canvasBackground;
        this.ctx.fillRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);

        if (!this.game.loadingCompleted && !this.game.loadingFailed) {
            this.drawText("Loading images...", "30px Arial", "#ee3030", "center", 0, 400);
            return;
        }
        else if (this.game.loadingFailed) {
            this.drawText("Loading failed!", "30px Arial", "#ee3030", "center", 0, 400);
            return;
        }

        // Draw the status bar
        this.drawStatusBar();

        // Draw the paddle
        // paddleThickness/2 is also the end cap radius, so we need to subtract that from x as well
        const paddleCenter = this.game.paddle.position;
        const leftCapWidth = this.images["paddle_left"].width;
        const rightCapWidth = this.images["paddle_right"].width;
        this.ctx.drawImage(this.images["paddle_left"], paddleCenter.x - Math.floor(this.game.paddle.width / 2), paddleCenter.y - this.settings.paddleThickness / 2);
        this.ctx.drawImage(this.images["paddle_center"], paddleCenter.x - Math.ceil(this.game.paddle.width / 2) + leftCapWidth,
                                                         paddleCenter.y - this.settings.paddleThickness / 2,
                                                         this.game.paddle.width - leftCapWidth - rightCapWidth,
                                                         this.settings.paddleThickness);
        this.ctx.drawImage(this.images["paddle_right"], paddleCenter.x + Math.floor(this.game.paddle.width / 2) - rightCapWidth - 1, paddleCenter.y - this.settings.paddleThickness / 2);

        // Draw the paddle sticky effect
        if (this.game.paddle.sticky) {
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            this.ctx.strokeStyle = "#21c00a"; // "#45ff45";
            this.ctx.lineCap = "round";
            const lineCapWidth = this.settings.paddleThickness / 2;
            this.ctx.moveTo(paddleCenter.x - this.game.paddle.width / 2 + lineCapWidth, paddleCenter.y);
            this.ctx.lineTo(paddleCenter.x + this.game.paddle.width / 2 - lineCapWidth, paddleCenter.y);
            this.ctx.lineWidth = this.settings.paddleThickness;
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        }

        // Draw the bricks
        this.drawBricks();

        // Draw powerups
        for (let powerup of this.game.visiblePowerups) {
            const r = this.settings.powerupImageRadius;
            const osc = 3 * Math.sin(powerup.phase);
            this.ctx.drawImage(this.images[powerup.image], powerup.position.x - r - osc/2, powerup.position.y - r, r * 2 + osc, r * 2);
        }

        // Draw the aim line
        if (this.game.shouldDrawAimLine()) {
            let originX = this.game.paddle.stuckBall ? this.game.paddle.stuckBall.position.x : this.game.paddle.position.x;
            let originY = this.game.paddle.position.y - this.settings.ballRadius - this.settings.paddleThickness / 2 + 1;
            let targetX = originX + this.settings.aimLineLength * Math.sin(this.game.paddle.aimAngle);
            let targetY = originY - this.settings.aimLineLength * Math.cos(this.game.paddle.aimAngle);
            this.ctx.beginPath();
            this.ctx.strokeStyle = "#ff3030";
            this.ctx.setLineDash([0, 20]);
            this.ctx.lineDashOffset = this.game.aimDashOffset;
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
        for (let ball of this.game.balls) {
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
            if (this.game.gamePaused && ball.velocity.mag() > 0.1) {
                this.ctx.beginPath();
                this.ctx.lineWidth = 2;
                this.ctx.strokeStyle = "#60ff60";
                this.ctx.moveTo(ball.position.x, ball.position.y);
                this.ctx.lineTo(ball.position.x + ball.velocity.x * 100, ball.position.y + ball.velocity.y * 100);
                this.ctx.stroke();
            }
        }

        if (this.game.devMenuOpen) {
            this.drawText("1  Sticky", "20px Arial", "black", "left", 10, 500);
            this.drawText("2  Ultrawide", "20px Arial", "black", "left", 10, 520);
            this.drawText("3  Multiball", "20px Arial", "black", "left", 10, 540);
            this.drawText("4  Fireball", "20px Arial", "black", "left", 10, 560);
            this.drawText("5  Extra life", "20px Arial", "black", "left", 10, 580);
            this.drawText("A  Close menu", "20px Arial", "black", "left", 10, 600);
        }

        if (this.game.gameWon) {
            this.drawText(`A WINNER IS YOU!`, "60px Arial", "#ee3030", "center", 0, 520);
            this.drawText(`Score: ${this.game.score}`, "60px Arial", "#ee3030", "center", 0, 580);
            this.drawText("Click to restart the game.", "40px Arial", "#ee3030", "center", 0, 635);
        }

        if (this.game.gamePaused) {
            this.drawText("PAUSED", "100px Arial Bold", "black", "center", 0, 520);
        }
        else if (this.game.gameLost) {
            this.drawText(`Sorry, you lost!`, "60px Arial", "#ee3030", "center", 0, 520);
            this.drawText(`Score: ${this.game.score}`, "60px Arial", "#ee3030", "center", 0, 580);
            this.drawText("Click to restart the game.", "40px Arial", "#ee3030", "center", 0, 635);
            return;
        }
    }

    snapCursorPosition(cursor: Vec2): Vec2 {
        let snapped = new Vec2(cursor);

        // Basically, round to the nearest brick, then find the center coordinates of that.
        snapped.x = brickCoordsFromDrawCoords("x", snapped.x, this.settings);
        snapped.y = brickCoordsFromDrawCoords("y", snapped.y, this.settings);
        snapped.x = drawCoordsFromBrickCoords("x", snapped.x, this.settings) + this.settings.brickWidth / 2;
        snapped.y = drawCoordsFromBrickCoords("y", snapped.y, this.settings) + this.settings.brickHeight / 2;

        return snapped;
    }

    drawEditorFrame() {
        const e = this.game.editor;

        // Clear the frame
        this.ctx.fillStyle = this.settings.canvasBackground;
        this.ctx.fillRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);

        this.drawBricks();

        // Draw the mouse pointer (last of all, so that it is on top)
        const maxY = this.settings.levelHeight * this.settings.brickHeight + this.settings.levelHeight * this.settings.brickSpacing;

        if (e.activeBrick && e.cursor.y <= maxY) {
            const pos = this.snapCursorPosition(e.cursor);
            this.ctx.globalAlpha = 0.6;
            this.ctx.drawImage(this.images[e.activeBrick], pos.x - this.settings.brickWidth / 2, pos.y - this.settings.brickHeight / 2);
            this.ctx.globalAlpha = 1.0;
        }
        else
            this.ctx.drawImage(this.images["mouse_pointer"], e.cursor.x, e.cursor.y);
    }

    drawBricks() {
        const brickSource = (this.game.currentMode === "game") ? this.game.level.bricks : this.game.editor.bricks;
        for (let brick of _.flatten(brickSource)) {
            if (brick === undefined)
                continue;
            this.ctx.drawImage(this.images[brick.name], brick.upperLeft.x, brick.upperLeft.y, this.settings.brickWidth, this.settings.brickHeight);
        }

        if (this.game.currentMode === "editor") {
            // Draw the brick palette
            let x = 0;
            for (let suffix of this.game.editor.brickPalette) {
                const name = `brick${suffix}`;
                const spacing = 4;
                let xCoord = spacing + x * (this.settings.brickWidth + (x > 0 ? spacing : 0));
                this.ctx.drawImage(this.images[name], xCoord, this.settings.paletteY, this.settings.brickWidth, this.settings.brickHeight);
                x++;
            }
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
        if (this.game.livesRemaining >= 1) {
            lives = (this.game.livesRemaining - 1).toString();
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
        let time = formatTime(Math.floor(this.game.totalGameTime / 1000));
        this.drawText(time, `${fontSize}px ${fontName}`, textColor, "left", x, textY, this.sctx);
        x += iconTextSpacing + time.length * charWidth - 3;

        // Draw the score
        this.sctx.drawImage(this.images["score"], x, iconY);
        x += iconSize + iconTextSpacing + 2;
        this.drawText(this.game.score.toString(), `${fontSize}px ${fontName}`, textColor, "left", x, textY, this.sctx);
        x += 4 + iconTextSpacing + this.game.score.toString().length * charWidth;

        // Draw active powerups
        x -= 2;
        const y = (this.settings.statusbarHeight - powerupSize) / 2;
        for (let powerup of this.game.activePowerups) {
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
        this.drawText(`FPS: ${Math.floor(this.game.lastFPS)}`, "18px Arial", "#ee3030", "right", this.settings.canvasWidth - 10, this.settings.statusbarHeight / 2, this.sctx);
        this.sctx.textBaseline = "alphabetic";
        */
    }
}
