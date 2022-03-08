import _ from "lodash";
import { Editor } from "./Editor";
import { Game } from "./Game";
import { RepetitionLimitedPowerup, TimeLimitedPowerup } from "./Powerups";
import { Settings } from "./Settings";
import { LevelSelector } from "./UI/LevelSelector";
import { NotificationDialog } from "./UI/NotificationDialog";
import { brickCoordsFromDrawCoords, calculateSymmetricPositions, clamp, drawCoordsFromBrickCoords, formatTime, levelCenter, snapSymmetryCenter, UIButton, UIElement, UIHorizontalSeparator, validBrickPosition } from "./Utils";
import { BrickPosition, Vec2 } from "./Vec2";
import { Window, WindowManager } from "./WindowManager";

export class DrawingHandler {
    canvas: HTMLCanvasElement;
    statusbarCanvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    sctx: CanvasRenderingContext2D;
    settings: Settings;
    game: Game;
    editor: Editor;

    // Used for optimization; a naive way to draw the grid performs HORRIBLY (below 10 fps)
    gridCanvas: HTMLCanvasElement;

    images: Record<string, HTMLImageElement> = {};

    generateGridCanvas(): HTMLCanvasElement {
        const lineWidth = 2;

        let canvas = document.createElement('canvas');
        canvas.width = this.settings.canvasWidth;
        canvas.height = this.settings.canvasHeight;

        let context = canvas.getContext('2d', { alpha: true })!;
        context.globalAlpha = 0.3;
        context.strokeStyle = "black";
        context.lineWidth = lineWidth;
        context.lineCap = "butt";

        const horizontalLine = (y: number) => {
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(lineWidth + this.settings.levelWidth * (this.settings.brickSpacing + this.settings.brickWidth), y);
            context.stroke();
        };
        const verticalLine = (x: number) => {
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, lineWidth + (this.settings.levelHeight - 1) * (this.settings.brickSpacing + this.settings.brickHeight));
            context.stroke();
        };

        let xPos = this.settings.brickSpacing / 2;
        for (let x = 0; x <= this.settings.levelWidth; x++) {
            verticalLine(xPos);
            xPos += this.settings.brickSpacing + this.settings.brickWidth;
        }

        let yPos = this.settings.brickSpacing / 2;
        for (let y = 0; y < this.settings.levelHeight; y++) {
            horizontalLine(yPos);
            yPos += this.settings.brickSpacing + this.settings.brickHeight;
        }

        // Draw special lines for the very center of the grid
        context.strokeStyle = "#440044";
        context.lineWidth = 2;
        context.setLineDash([1, 1]);
        verticalLine(levelCenter("x", this.settings));
        horizontalLine(levelCenter("y", this.settings));

        context.globalAlpha = 1.0;

        return canvas;
    }

    constructor(game: Game, editor: Editor, canvas: HTMLCanvasElement, statusbarCanvas: HTMLCanvasElement, settings: Settings, imagesLoadedCallback: () => void) {
        this.settings = settings;
        this.game = game;
        this.editor = editor;
        this.canvas = canvas;
        this.gridCanvas = this.generateGridCanvas();
        this.statusbarCanvas = statusbarCanvas;
        this.ctx = canvas.getContext('2d', { alpha: false })!;
        this.sctx = statusbarCanvas.getContext('2d', { alpha: false })!

        let imageFilenames = ["brick_indestructible", "paddle_left", "paddle_center", "paddle_right",
                              "ball", "powerup_sticky", "powerup_multiball", "powerup_fireball", "powerup_extralife", "powerup_ultrawide",
                              "fireball", "statusbar", "heart", "score", "clock", "cursor_regular", "cursor_select", "cursor_deselect", "brick_delete",
                              "button_pushed", "button_unpushed", "icon_grid", "icon_hsymmetry", "icon_vsymmetry", "icon_symmetry_center", "new_level",
                              "icon_trash", "icon_new", "icon_load", "icon_save", "separator", "icon_return", "icon_marquee", "icon_playtest"];
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
                // Doesn't use notifyWithButton because I'm not sure it'd work great this early; as of this writing
                // it wouldn't work, our custom drawing hasn't started yet.
                alert(`Failed to load image "${name}.png"!` + (ev.message ? ` ${ev.message}` : ""));
            });
            img.src = `img/${name}.png`;
        }

    }

    drawText(text: string, font: string, fillStyle: string, textAlign: CanvasTextAlign, x: number, y: number, context = this.ctx) {
        context.beginPath();
        context.font = font;
        context.fillStyle = fillStyle;
        context.textAlign = textAlign;
        if (textAlign == "center")
            x = this.settings.canvasWidth / 2;
        context.fillText(text, x, y);
    }

    dim(amount: number = 0.3) {
        // Draw a partially transparent overlay
        this.ctx.globalAlpha = clamp(amount, 0.01, 0.99);
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);
        this.ctx.globalAlpha = 1.0;
    }

    drawLoadingScreen() {
        let screen = WindowManager.getInstance().getLoadingScreen();
        if (screen) {
            this.dim();
            screen.draw(this.ctx);
        }
    }

    drawConfirmationDialog() {
        let dialog = WindowManager.getInstance().getConfirmationDialog();
        if (dialog) {
            this.dim(0.2);
            dialog.draw(this.ctx);
            if (dialog.positiveButton)
                this.drawButton(dialog.positiveButton);
            if (dialog.negativeButton)
                this.drawButton(dialog.negativeButton);
        }
    }

    drawGameFrame() {
        // Clear the frame
        this.ctx.fillStyle = this.settings.canvasBackground;
        this.ctx.fillRect(0, 0, this.settings.canvasWidth, this.settings.canvasHeight);
        this.ctx.beginPath();

        // Draw a temporary background in the status bar, so that it's not black while loading
        this.sctx.fillStyle = this.settings.canvasBackground;
        this.sctx.fillRect(0, 0, this.settings.canvasWidth, this.settings.statusbarHeight);

        if (!this.game.imageLoadingCompleted && !this.game.loadingFailed) {
            this.drawText("Loading images...", "30px Arial", "#ee3030", "center", 0, 400);
            return;
        }
        else if (this.game.loadingFailed) {
            this.drawText("Loading failed!", "30px Arial", "#ee3030", "center", 0, 400);
            return;
        }

        // Handle the initial level load
        if (!this.game.levelLoadingCompleted) {
            if (this.game.levelSelector)
                this.drawLevelSelector(this.game.levelSelector);

            this.drawConfirmationDialog();
            this.drawLoadingScreen();
            this.drawCursor("cursor_regular", false);

            this.sctx.drawImage(this.images["statusbar"], 0, 0, this.settings.canvasWidth, this.settings.statusbarHeight);
            return;
        }

        // Draw the status bar
        this.drawStatusBar();

        // Draw the paddle
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
            this.ctx.strokeStyle = "#21c00a";
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

        this.drawConfirmationDialog();
        this.drawLoadingScreen();
        this.drawNotificationDialog();
        if (WindowManager.getInstance().activeWindow !== this.game)
            this.drawCursor("cursor_regular", false);

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

    // Only used for actual mouse cursors, not blocks about to be placed
    drawCursor(imageName: string, offset: boolean, pos: Vec2 = this.editor.cursor) {
        const width = this.images[imageName].width;
        const height = this.images[imageName].height;
        this.ctx.drawImage(this.images[imageName], pos.x - (offset ? width/2 : 0), pos.y - (offset ? height/2 : 0));
    }

    drawEditorToolbar() {
        this.ctx.globalAlpha = 1.0;
        this.ctx.fillStyle = "#e5e5e5";
        this.ctx.fillRect(this.settings.canvasWidth, 0, this.settings.editorToolbarWidth, this.settings.canvasHeight);
        this.ctx.beginPath();
        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 1;
        this.ctx.moveTo(this.settings.canvasWidth - 1, 0);
        this.ctx.lineTo(this.settings.canvasWidth - 1, this.settings.canvasHeight);
        this.ctx.stroke();

        for (let button of this.editor.toolbarButtons) {
            this.drawButton(button);
        }
    }

    drawButton(button: UIElement) {
        if (button instanceof UIHorizontalSeparator) {
            this.ctx.drawImage(this.images["separator"], button.rect.left, button.rect.top);
            return;
        }

        if (!(button instanceof UIButton))
            return;

        if (button.hidden)
            return;

        if (button.image) {
            // Draw an icon-based button
            const foregroundImage = this.images[button.image];

            if (button.drawBackground) {
                const backgroundImage = button.enabled ? this.images["button_pushed"] : this.images["button_unpushed"];
                this.ctx.drawImage(backgroundImage, button.rect.left, button.rect.top, foregroundImage.width, foregroundImage.height);
            }

            this.ctx.drawImage(foregroundImage, button.rect.left, button.rect.top);
        }
        else {
            // Draw a text button
            this.ctx.beginPath();
            this.ctx.fillStyle = "#efefef";
            this.ctx.strokeStyle = "black";
            this.ctx.lineWidth = 1;
            this.ctx.fillRect(button.rect.left, button.rect.top, button.rect.width, button.rect.height);
            this.ctx.strokeRect(button.rect.left, button.rect.top, button.rect.width, button.rect.height);
            this.ctx.fillStyle = "black";
            const old = this.ctx.textBaseline;
            this.ctx.textBaseline = "middle";
            this.ctx.textAlign = "center";
            if (!button.enabled)
                this.ctx.fillStyle = "#afafaf";
            const oldFont = this.ctx.font;
            this.ctx.font = "14px Arial";
            this.ctx.fillText(button.tooltip, button.rect.horizontalCenter, button.rect.verticalCenter);

            this.ctx.font = oldFont;
            this.ctx.textBaseline = old;
            this.ctx.textAlign = "start";
            this.ctx.strokeStyle = "black";
        }
    }

    drawEditorFrame() {
        const e = this.editor;

        // Clear the frame
        this.ctx.beginPath();
        this.ctx.fillStyle = this.settings.canvasBackground;
        this.ctx.fillRect(0, 0, this.settings.canvasWidth + this.settings.editorToolbarWidth, this.settings.canvasHeight);

        this.drawEditorToolbar();

        if (e.shouldDrawGrid || e.setSymmetryCenter)
            this.drawGrid();

        this.drawBricks();

        // Draw the symmetry center, if symmetry is enabled, and we're not currently changing it (in which case it's drawn as the cursor, instead!)
        if ((e.verticalSymmetry || e.horizontalSymmetry) && !e.setSymmetryCenter) {
            this.drawCursor("icon_symmetry_center", true, e.symmetryCenter);
        }

        if (e.levelSelector) {
            this.drawLevelSelector(e.levelSelector);
//            this.drawText(`FPS: ${Math.floor(this.game.lastFPS)}`, "18px Arial", "#ee3030", "right", this.settings.canvasWidth - 10, 20);
            this.drawConfirmationDialog();
            this.drawLoadingScreen();
            this.drawNotificationDialog();
            this.drawCursor("cursor_regular", false);
            return;
        }

        if (this.editor.marqueeActive && this.editor.marqueeStart)
            this.drawMarquee();

        this.drawConfirmationDialog();
        this.drawLoadingScreen();
        this.drawNotificationDialog();

        // Draw tooltips on toolbar icon hover
        this.drawTooltips();

        // Draw the active brick / mouse pointer (last of all, so that it is on top)
        const maxY = (this.settings.levelHeight - 1) * this.settings.brickHeight + (this.settings.levelHeight - 1) * this.settings.brickSpacing;

        if (WindowManager.getInstance().activeWindow === this.editor && e.cursor.y < maxY && e.cursor.x < this.settings.canvasWidth) {
            // Cursor is in the level area
            if (e.setSymmetryCenter) {
                let pos = snapSymmetryCenter(this.editor.cursor, this.settings);
                this.drawCursor("icon_symmetry_center", true, pos);
            }
            else if (e.marqueeActive)
                this.drawCursor("cursor_select", true);
            else if (e.shiftDown)
                this.drawCursor("cursor_select", true);
            else if (e.altDown)
                this.drawCursor("cursor_deselect", true)
            else {
                // Draw the active brick, with symmetric copies if applicable
                let brickPos = new BrickPosition();
                brickPos.x = brickCoordsFromDrawCoords("x", e.cursor.x, this.settings);
                brickPos.y = brickCoordsFromDrawCoords("y", e.cursor.y, this.settings);

                const symmetricBricks = calculateSymmetricPositions(brickPos, e.symmetryCenter, e.horizontalSymmetry, e.verticalSymmetry, this.settings);

                for (let brick of symmetricBricks) {
                    if (!validBrickPosition(brick, this.settings))
                        continue;
                    const originalBrick: boolean = (brickPos.x === brick.x && brickPos.y === brick.y);
                    brick.x = drawCoordsFromBrickCoords("x", brick.x, this.settings) + this.settings.brickWidth / 2;
                    brick.y = drawCoordsFromBrickCoords("y", brick.y, this.settings) + this.settings.brickHeight / 2;

                    // Only highlight the original block, where the mouse pointer actually is
                    this.drawEditorCursorBlock(brick, originalBrick);
                }
            }
        }
        else
            this.drawCursor("cursor_regular", false);

    }

    drawNotificationDialog() {
        let dialogs = WindowManager.getInstance().getWindowsMatching((window: Window) => {
            return (window instanceof NotificationDialog);
        });

        for (let dialog of dialogs) {
            let notificationDialog = dialog as NotificationDialog;
            notificationDialog.draw(this.ctx);

            if (notificationDialog.positiveButton)
                this.drawButton(notificationDialog.positiveButton);
            if (notificationDialog.negativeButton)
                this.drawButton(notificationDialog.negativeButton);

            // Only draw the first/oldest dialog for now. When it times out or is removed by the user,
            // we draw the next one, until there are none left.
            return;
        }
    }

    drawMarquee() {
        if (!this.editor.marqueeStart) return;
        let start = this.editor.marqueeStart;
        let end = this.editor.cursor;

        this.ctx.lineWidth = 2;
        this.ctx.lineCap = "butt";
        this.ctx.setLineDash([8, 3]);
        this.ctx.strokeStyle = "black";

        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const w = Math.abs(start.x - end.x);
        const h = Math.abs(start.y - end.y);
        this.ctx.strokeRect(x, y, w, h);

        this.ctx.setLineDash([]);
        this.ctx.lineWidth = 1;
    }

    drawLevelSelector(sel: LevelSelector) {
        this.ctx.translate(sel.pos.x, sel.pos.y);
        const source = (this.game.currentMode === "game") ? this.game.level.bricks : this.editor.bricks;

        if (sel.draw(this.ctx, source, this.images)) {
            for (let button of sel.buttons) {
                this.drawButton(button);
            }
        }

        this.ctx.translate(-sel.pos.x, -sel.pos.y);
    }

    drawTooltips() {
        for (let button of this.editor.toolbarButtons) {
            if (!(button instanceof UIButton)) continue;
            if (button.rect.isInsideRect(this.editor.cursor)) {
                this.ctx.beginPath();
                this.ctx.font = "14px Arial";
                this.ctx.strokeStyle = "black";
                this.ctx.textBaseline = "middle";
                const width = this.ctx.measureText(button.tooltip).width;
                const height = parseInt(this.ctx.font) + 4;
                const padding = 8;
                const dist = 16; // Distance from button
                this.ctx.fillStyle = "#e9e9e9";
                this.ctx.strokeStyle = "black";
                this.ctx.lineWidth = 1;

                const left = button.rect.left - width - padding - dist;
                const top = (button.rect.bottom + button.rect.top)/2 - height/2 - padding;
                this.ctx.fillRect(left, top, width + 2 * padding, height + 2 * padding);
                this.ctx.strokeRect(left, top, width + 2 * padding, height + 2 * padding);
                this.drawText(button.tooltip, "14px Arial", "black", "left", button.rect.left - width - dist, (button.rect.bottom + button.rect.top)/2);
            }
        }
    }

    drawGrid() {
        this.ctx.globalAlpha = 1.0;
        this.ctx.drawImage(this.gridCanvas, 0, 0);
    }

    drawEditorCursorBlock(pos: BrickPosition, highlight: boolean) {
        this.ctx.globalAlpha = 0.6;
        this.ctx.drawImage(this.images[this.editor.activeBrick], pos.x - this.settings.brickWidth / 2, pos.y - this.settings.brickHeight / 2);
        this.ctx.globalAlpha = 1.0;

        if (highlight) {
            // Draw a border around the image; otherwise, the mouse location is invisible when hovering over blocks of the same color.
            this.ctx.beginPath();
            this.ctx.strokeStyle = "red";
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(pos.x - this.settings.brickWidth / 2 - 2, pos.y - this.settings.brickHeight / 2 - 2, this.settings.brickWidth + 4, this.settings.brickHeight + 4);
        }
    }

    drawBricks() {
        const brickSource = (this.game.currentMode === "game") ? this.game.level.bricks : this.editor.bricks;

        for (let y = 0; y < this.settings.levelHeight; y++) {
            for (let x = 0; x < this.settings.levelWidth; x++) {
                const brick = brickSource[y][x];
                if (brick === undefined)
                    continue;
                this.ctx.drawImage(this.images[brick.name], brick.upperLeft.x, brick.upperLeft.y, this.settings.brickWidth, this.settings.brickHeight);

                if (brick.selected) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = "blue";
                    this.ctx.globalAlpha = 1.0;
                    this.ctx.lineWidth = 2;
                    const pos = brick.upperLeft;
                    this.ctx.strokeRect(pos.x - 2, pos.y - 2, this.settings.brickWidth + 4, this.settings.brickHeight + 4);
                }
            }
        }

        if (this.game.currentMode === "editor") {
            // Draw the brick palette
            let x = 0;
            for (let suffix of this.editor.brickPalette) {
                const name = `brick${suffix}`;
                const spacing = 4;
                let xCoord = spacing + x * (this.settings.brickWidth + (x > 0 ? spacing : 0));
                this.ctx.drawImage(this.images[name], xCoord, this.settings.paletteY, this.settings.brickWidth, this.settings.brickHeight);

                if (this.editor.activeBrick === name) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = "blue";
                    this.ctx.globalAlpha = 1.0;
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(xCoord - 2, this.settings.paletteY - 2, this.settings.brickWidth + 4, this.settings.brickHeight + 4);
                }

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
        this.sctx.beginPath();
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
                const remaining = powerup.effectTime - powerup.activeTime;
                if ((remaining < 1000 && remaining >= 750) || (remaining < 500 && remaining >= 250))
                    draw = false;
                if (remaining < powerup.instanceEffectTime / 5 || remaining < 1500)
                    drawRed = true;
            }
            else if (powerup instanceof RepetitionLimitedPowerup && (powerup.repetitionLimit - powerup.repetitions) <= 1)
                drawRed = true;

            if (draw)
                this.sctx.drawImage(this.images[powerup.image], x, y, powerupSize, powerupSize);

            let ratio: number | undefined;
            if (powerup instanceof TimeLimitedPowerup)
                ratio = (powerup.effectTime - powerup.activeTime) / powerup.effectTime;
            else if (powerup instanceof RepetitionLimitedPowerup)
                ratio = (powerup.repetitionLimit - powerup.repetitions) / powerup.repetitionLimit;

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
//        this.drawText(`FPS: ${Math.floor(this.game.lastFPS)}`, "18px Arial", "#ee3030", "right", this.settings.canvasWidth - 10, 20);
    }
}
