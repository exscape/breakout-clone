import _ from "lodash";
import { BrickOrEmpty } from "./Brick";
import { Settings } from "./Settings";
import { drawCoordsFromBrickCoords, fetchLevelIndex, generateEmptyBrickArray, LevelMetadata, loadBricksFromLevelText, Rect, UIButton, wrapText } from "./Utils";
import { Vec2 } from "./Vec2";

export class LevelSelector {
    settings: Settings;
    readonly width = 687;
    readonly height = 603;
    readonly padding = 5;
    pos: Vec2;
    windowTitle: string;
    levelName: string;
    selectorType: "load" | "save";

    levelRects: Rect[] = [];

    loadingLevelList: boolean = true;
    levelList: LevelMetadata[] = [];

    saveCallback: ((levelName: string) => void);
    cancelCallback: (() => void);
    readonly validCharacters: string[] = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789. +()[]{}-".split("");
    readonly maxLevelnameLength = 28;
    readonly ourSaveCallback = (_: boolean) => {
            console.log("Save");
            this.saveCallback(this.levelName);
    };
    cursor: Vec2;
    buttons: UIButton[] = [];

    // For loading: disabled if no valid level is selected
    // For saving: disabled if the name is already used, name is empty, or name is Untitled
    enableOkButton: boolean = false;

    constructor(type: "load" | "save", levelName: string | null, cursor: Vec2, settings: Settings, saveCallback: (levelName: string) => void, cancelCallback: () => void) {
        this.windowTitle = (type === "load") ? "Load level" : "Save level";
        this.settings = settings;
        this.cursor = cursor;
        this.pos = new Vec2(Math.floor((this.settings.canvasWidth - this.width) / 2), Math.floor((this.settings.canvasHeight - this.height) / 2));
        if (type === "save")
            this.levelName = "Untitled";
        else if (!levelName)
            throw new Error("levelName can't be null for a load window");
        else
            this.levelName = levelName;
        this.selectorType = type;

        this.saveCallback = saveCallback;
        this.cancelCallback = cancelCallback;

        this.fetchLevelList();
    }

    fetchLevelList() {
        try {
            fetchLevelIndex("standalone", (levels: LevelMetadata[]) => {
                this.levelList = levels;
                this.loadingLevelList = false;
            });
        }
        catch (e: any) {
            this.cancelCallback();
        }
    }

    draw(ctx: CanvasRenderingContext2D, brickSource: BrickOrEmpty[][], images: Record<string, HTMLImageElement>): boolean {
        // Full window
        ctx.beginPath();
        ctx.textAlign = "start";
        ctx.fillStyle = "#e5e5e5";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;

        // Show a loading screen while fetching from the server
        if (this.loadingLevelList) {
            const loadingWidth = 280;
            const loadingHeight = 70;
            ctx.fillRect((this.width - loadingWidth) / 2, (this.height - loadingHeight) / 2, loadingWidth, loadingHeight);
            ctx.strokeRect((this.width - loadingWidth) / 2, (this.height - loadingHeight) / 2, loadingWidth, loadingHeight);

            ctx.fillStyle = "black";
            ctx.font = "22px Arial";
            const text = "Loading level list..."
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, this.width / 2, this.height / 2);
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";

            // Abort drawing of everything else, e.g. buttons, in DrawingHandler
            return false;
        }

        // TODO: Handle failure when fetching from the server



        ctx.fillRect(0, 0, this.width, this.height);
        ctx.strokeRect(0, 0, this.width, this.height);

        // Title bar
        ctx.beginPath();
        ctx.font = "14px Arial";
        const lineY = 0 + this.padding + parseInt(ctx.font) + this.padding;
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(0, 0, this.width, lineY - 0);
        ctx.strokeRect(0, 0, this.width, lineY - 0);
        ctx.fillStyle = "black";
        ctx.textBaseline = "top";
        ctx.fillText(this.windowTitle, 0 + this.padding, 0 + this.padding);

        // List of levels, with scrollbar if needed
        const levelListY = lineY + this.padding;
        ctx.translate(this.padding, levelListY);
        const levelListHeight = 185;
        const offset = new Vec2(this.pos.x + this.padding, this.pos.y + levelListY);
        this.drawLevelList(offset, ctx, images, brickSource, levelListHeight);
        ctx.translate(-this.padding, -levelListY);

        // Selected level preview (large)
        let previewSettings = _.clone(this.settings);
        const levelPreviewY = levelListY + levelListHeight + this.padding;
        previewSettings.brickHeight = this.settings.brickHeight / 2;
        previewSettings.brickWidth = this.settings.brickWidth / 2;
        previewSettings.brickSpacing = this.settings.brickSpacing / 2;
        this.drawLevelPreview(ctx, brickSource, images, previewSettings, new Vec2(this.padding, levelPreviewY));

        // Label, textedit, buttons
        ctx.beginPath();
        const levelNameY = levelPreviewY + 344 + 2 * this.padding + 2;
        const labelText = "Level name: ";
        const {width} = ctx.measureText(labelText);
        const old = ctx.textBaseline;
        ctx.fillStyle = "#fdfdfd";
        ctx.fillRect(2 * this.padding + width, levelNameY, 405, parseInt(ctx.font) + this.padding);
        ctx.strokeRect(2 * this.padding + width, levelNameY, 405, parseInt(ctx.font) + this.padding);

        ctx.textBaseline = "middle";
        ctx.fillStyle = "black";
        const textY = levelNameY + parseInt(ctx.font)/2 + this.padding/2;
        ctx.fillText(labelText, this.padding, textY);
        ctx.fillStyle = "black";
        ctx.fillText(this.levelName + "_", 3 * this.padding + width, textY);

        ctx.textBaseline = old;

        // Create the buttons, hacky right alignment
        // TODO: This creates NEW buttons EVERY FRAME!
        const buttonWidth = 80;
        const buttonHeight = 20;
        const saveRect = new Rect(this.width - this.padding - buttonWidth, levelNameY, buttonWidth, buttonHeight);
        const cancelRect = new Rect(this.width - this.padding - 2 * buttonWidth - 2 * this.padding, levelNameY, buttonWidth, buttonHeight);

        this.buttons.length = 0; // TODO: HACK to save performance -- we SHOULD NOT recreate these every frame!!!

        if (this.selectorType === "load") {
            this.enableOkButton = false; // TODO: update correctly
        }
        else {
            this.enableOkButton = (this.levelName.length > 0 && this.levelName != "Untitled" &&
                                   !this.levelList.some(lev => lev.name.trim() === this.levelName.trim()));
        }

        this.buttons.push (new UIButton(saveRect, null, "Save", this.enableOkButton, this.ourSaveCallback));
        this.buttons.push(new UIButton(cancelRect, null, "Cancel", true, (_: boolean) => {
            console.log("Cancel");
            this.cancelCallback();
        }));

        // TODO: Do we need to draw the levels in advance and save thumbnail images, or can we draw them as needed here?
        // TODO: I figure that assuming we only draw the levels that are ACTUALLY VISIBLE on screen it should be no problem whatsoever.

        return true;
    }

    drawLevelList(offset: Vec2, ctx: CanvasRenderingContext2D, images: Record<string, HTMLImageElement>, currentLevelBrickSource: BrickOrEmpty[][], height: number) {
        // Outline
        const width = this.width - 2 * this.padding;
        ctx.beginPath();
        ctx.fillStyle = this.settings.canvasBackground;
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.fillStyle = "#fdfdfd";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeRect(0, 0, width, height);

        // Initialize click areas for the levels
        if (this.levelRects.length === 0) {
            for (let x = 0; x < 3; x++) {
                this.levelRects.push(new Rect(offset.x + x * width/3, offset.y, width/3, height));
            }
        }

        // TODO: remove later, except for the currently selected level
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        for (let i = 0; i < this.levelRects.length; i++) {
            if (i == 0) ctx.fillStyle = "#ccccff";
            if (i == 1) ctx.fillStyle = "#ffcccc";
            if (i == 2) ctx.fillStyle = "#ccffcc";
            const r = this.levelRects[i];
            ctx.fillRect(r.left - offset.x, r.top - offset.y, r.right - r.left, r.bottom - r.top);
            ctx.strokeRect(r.left - offset.x, r.top - offset.y, r.right - r.left, r.bottom - r.top);
        }

        // Draw the levels
        const levelsToShow = Math.min(3, this.levelList.length); // TODO: calculate from total standalone level count + scroll position

        // TODO:
        // TODO: remember that #1 when saving should be the NEW LEVEL + icon, not an existing level!
        // TODO:

        for (let i = 0; i < Math.min(3, levelsToShow); i++) {
            // TODO: index used in loadBricks AND this.levelRects is incorrect -- update after pagination is implemented!!
            // TODO:
            let level = this.levelList[i];
            let levelBricks = generateEmptyBrickArray(this.settings);
            loadBricksFromLevelText(level.leveltext, levelBricks, this.settings);
            this.drawLevelThumbnail(offset, this.levelRects[i], ctx, levelBricks, images);

            const oldFont = ctx.font;
            ctx.fillStyle = "black";
            ctx.textAlign = "center";
            let y = 2 * this.padding;
            ctx.font = "14px Arial";
            ctx.fillText(`By ${level.author}`, this.levelRects[i].horizontalCenter - offset.x, 72);
            ctx.font = "18px Arial";

            // TODO: test with too many lines AND too long words!
            let lines = wrapText(ctx, level.name + " " + level.name + " " + level.name + " " + level.name, this.levelRects[i].width - 6 * this.padding);
            for (let line of lines.slice(0,2)) {
                ctx.fillText(line, this.levelRects[i].horizontalCenter - offset.x, y)
                y += parseInt(ctx.font) + 4;
            }

            ctx.textAlign = "left";
            ctx.font = oldFont;
        }
    }

    private drawLevelThumbnail(offset: Vec2, rect: Rect, ctx: CanvasRenderingContext2D, currentLevelBrickSource: BrickOrEmpty[][], images: Record<string, HTMLImageElement>) {
        let previewSettings = _.clone(this.settings);
        previewSettings.brickHeight = this.settings.brickHeight / 7;
        previewSettings.brickWidth = this.settings.brickWidth / 7;
        previewSettings.brickSpacing = 0;
        const x = rect.left - offset.x + (rect.right - rect.left - 185) / 2;
        this.drawLevelPreview(ctx, currentLevelBrickSource, images, previewSettings, new Vec2(x, rect.bottom - offset.y - this.padding - 86));
    }

    drawLevelPreview(ctx: CanvasRenderingContext2D, brickSource: BrickOrEmpty[][], images: Record<string, HTMLImageElement>, settings: Settings, pos: Vec2) {
        const previewWidth = settings.brickSpacing * (settings.levelWidth + 1) + settings.brickWidth * settings.levelWidth;
        const previewHeight = settings.brickSpacing * (settings.levelHeight) + settings.brickHeight * settings.levelHeight;
//        console.log(`Drawing preview of size ${previewWidth} x ${previewHeight}`);
        ctx.beginPath();
        ctx.strokeRect(pos.x, pos.y, previewWidth, previewHeight);
        ctx.fillStyle = this.settings.canvasBackground;
        ctx.fillRect(pos.x, pos.y, previewWidth, previewHeight);

        for (let y = 0; y < this.settings.levelHeight; y++) {
            for (let x = 0; x < this.settings.levelWidth; x++) {
                const brick = brickSource[y][x];
                if (!brick)
                    continue;

                const xCoord = drawCoordsFromBrickCoords("x", x, settings, pos.x);
                const yCoord = drawCoordsFromBrickCoords("y", y, settings, pos.y);
                ctx.drawImage(images[brick.name], xCoord, yCoord, settings.brickWidth, settings.brickHeight);
            }
        }
    }

    onmousedown(e: MouseEvent) {
        if (this.loadingLevelList) return;
        for (let button of this.buttons) {
            // Handle the fact that the Rect position is drawn relative to the window's top left, but the cursor is in global coordinates...
            let offsetCursor = _.clone(this.cursor);
            offsetCursor.x -= this.pos.x;
            offsetCursor.y -= this.pos.y;
            if (button.rect.isInsideRect(offsetCursor) && button.enabled)
                button.clickCallback(true);
        }
    }
    onmouseup(e: MouseEvent) {
        if (this.loadingLevelList) return;
    }
    keyUp(ev: KeyboardEvent) {
        if (this.loadingLevelList) return;
    }
    keyDown(ev: KeyboardEvent) {
        if (this.loadingLevelList) return;
        if ((ev.key == "Delete" || ev.key == "Backspace") && this.levelName.length > 0)
            this.levelName = this.levelName.substring(0, this.levelName.length - 1);
        else if (ev.key == "Enter") {
            this.ourSaveCallback(true);
        }
        else if (ev.key == "Escape") {
            ev.preventDefault();
            this.cancelCallback();
        }
        else if (this.validCharacters.includes(ev.key) && this.levelName.length < this.maxLevelnameLength)
            this.levelName += ev.key;
        else
            console.log("Invalid key: " + ev.key);
    }
}
