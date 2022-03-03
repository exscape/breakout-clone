import _ from "lodash";
import { BrickOrEmpty } from "../Brick";
import { Settings } from "../Settings";
import { clamp, drawCoordsFromBrickCoords, generateEmptyBrickArray, LevelMetadata, loadBricksFromLevelText, Rect, UIButton, wrapText } from "../Utils";
import { Vec2 } from "../Vec2";

// BEWARE: This code is by FAR the worst in this codebase as of when it's being written.
// I don't have the patience to write a proper windowing system for a single dialog, so this is FULL of
// horrifying hacks that I'm ashamed have created.

export class LevelSelector {
    settings: Settings;
    readonly width = 687;
    readonly height = 623;
    readonly padding = 5;
    pos: Vec2;
    windowTitle: string;
    levelName: string;
    selectorType: "load" | "save";

    // There are always three rects, regardless of level count.
    // 1-3 are used for each page of levels.
    levelRects: Rect[] = [];
    selectedRect: 0 | 1 | 2 = 0;

    levelList: LevelMetadata[];
    currentPage: number;
    totalPages: number;

    saveCallback: ((metadataOrName: LevelMetadata | string) => void);
    cancelCallback: (() => void);
    readonly validCharacters: string[] = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789. +()[]{}-".split("");
    readonly maxLevelnameLength = 28;
    readonly ourSaveCallback = (_: boolean) => {
        if (this.saveButton)
            this.saveButton.enabled = false;

        const newLevel = this.currentPage === 0 && this.selectedRect === 0;
        if (newLevel)
            this.saveCallback(this.levelName);
        else {
            let level = this.selectedLevel();
            if (level) {
                level.name = this.levelName;
                this.saveCallback(level);
            }
            else
                alert("BUG: selectedLevel() returned null");
        }
    };
    cursor: Vec2;
    buttons: UIButton[] = [];
    saveButton: UIButton | null = null;
    cancelButton: UIButton | null = null;
    homeButton: UIButton | null = null;
    prevButton: UIButton | null = null;
    nextButton: UIButton | null = null;
    endButton: UIButton | null = null;

    // TODO: Remove later, when initializiation isn't a hack in the draw methods
    saveCancelButtonsInitialized = false;
    navigationButtonsInitialized = false;

    // For loading: disabled if no valid level is selected
    // For saving: disabled if the name is already used, name is empty, or name is Untitled
    enableOkButton: boolean = false;

    constructor(type: "load" | "save", levelList: LevelMetadata[], cursor: Vec2, settings: Settings, saveCallback: (selectedLevel: LevelMetadata | string) => void, cancelCallback: () => void) {
        this.windowTitle = (type === "load") ? "Load level" : "Save level";
        this.levelList = levelList;
        this.settings = settings;
        this.cursor = cursor;
        this.pos = new Vec2(Math.floor((this.settings.canvasWidth - this.width) / 2), Math.floor((this.settings.canvasHeight - this.height) / 2));
        if (type === "save")
            this.levelName = "Untitled";
        else
            this.levelName = "";
        this.selectorType = type;

        this.saveCallback = saveCallback;
        this.cancelCallback = cancelCallback;

        this.currentPage = 0;
        this.totalPages = Math.ceil(levelList.length / 3);
    }

    draw(ctx: CanvasRenderingContext2D, brickSource: BrickOrEmpty[][], images: Record<string, HTMLImageElement>): boolean {
        // Full window
        ctx.beginPath();
        ctx.textAlign = "start";
        ctx.fillStyle = "#e5e5e5";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
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
        const levelListHeight = 200;
        const offset = new Vec2(this.pos.x + this.padding, this.pos.y + levelListY);
        this.drawLevelList(offset, ctx, images, levelListHeight);
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

        if (this.selectorType === "load") {
            this.enableOkButton = false; // TODO: update correctly
        }
        else {
            const nameUsedByOtherLevel = this.levelList.some(lev => lev.level_id !== this.selectedLevel()?.level_id && lev.name.trim() === this.levelName.trim());

            this.enableOkButton = (this.levelName.length > 0 && this.levelName != "Untitled") &&
                                !nameUsedByOtherLevel;
        }

        // Create the buttons, hacky right alignment
        if (!this.saveCancelButtonsInitialized) {
            const buttonWidth = 80;
            const buttonHeight = 20;
            const saveRect = new Rect(this.width - this.padding - buttonWidth, levelNameY, buttonWidth, buttonHeight);
            const cancelRect = new Rect(this.width - this.padding - 2 * buttonWidth - 2 * this.padding, levelNameY, buttonWidth, buttonHeight);

            this.saveButton = new UIButton(saveRect, null, "Save", this.enableOkButton, this.ourSaveCallback);
            this.cancelButton = new UIButton(cancelRect, null, "Cancel", true, (_: boolean) => {
                console.log("Cancel");
                this.cancelCallback();
            });

            this.buttons.push(this.saveButton);
            this.buttons.push(this.cancelButton);
            this.saveCancelButtonsInitialized = true;
        }
        else if (this.saveButton)
            this.saveButton.enabled = this.enableOkButton;

        return true;
    }

    drawLevelList(offset: Vec2, ctx: CanvasRenderingContext2D, images: Record<string, HTMLImageElement>, height: number) {
        // Outline
        const width = this.width - 2 * this.padding;
        ctx.beginPath();
        ctx.fillStyle = this.settings.canvasBackground;
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.fillStyle = "#fdfdfd";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeRect(0, 0, width, height);

        const buttonHeight = 20;
        // Initialize click areas for the levels
        if (this.levelRects.length === 0) {
            for (let x = 0; x < 3; x++) {
                this.levelRects.push(new Rect(offset.x + x * width/3 + 1, offset.y + 1, width/3 - 2, height - buttonHeight - 2));
            }
        }
        const buttonWidth = this.levelRects[0].width / 2;

        // Draw the background for the highlighted level
        const r = this.levelRects[this.selectedRect];
        ctx.fillStyle = "#dedeff";
        ctx.fillRect(r.left - offset.x, r.top - offset.y, r.right - r.left, r.bottom - r.top);

        // Draw separators between the levels
        ctx.beginPath();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.moveTo(this.levelRects[0].right - offset.x, this.levelRects[0].top - offset.y);
        ctx.lineTo(this.levelRects[0].right - offset.x, this.levelRects[0].bottom - offset.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.levelRects[2].left - offset.x, this.levelRects[1].top - offset.y);
        ctx.lineTo(this.levelRects[2].left - offset.x, this.levelRects[1].bottom - offset.y);
        ctx.stroke();

        // Create buttons for navigation
        // I genuinely don't know why this offset is required... and the fact that it's 1.5 times the button height is just perplexing. Is that just random chance or what?!
        // I spent perhaps 30 minutes trying to get this right a more reasonable way, but in the end gave up.
        const wtf = buttonHeight * 1.5;
        if (!this.navigationButtonsInitialized) {
            const homeRect = new Rect(this.levelRects[0].left - offset.x + this.padding,               this.levelRects[0].bottom - offset.y + wtf, buttonWidth, buttonHeight);
            const prevRect = new Rect(this.levelRects[0].left - offset.x + this.padding + buttonWidth, this.levelRects[0].bottom - offset.y + wtf, buttonWidth, buttonHeight);
            const nextRect = new Rect(this.levelRects[2].left - offset.x + this.padding,               this.levelRects[0].bottom - offset.y + wtf, buttonWidth, buttonHeight);
            const endRect  = new Rect(this.levelRects[2].left - offset.x + this.padding + buttonWidth, this.levelRects[0].bottom - offset.y + wtf, buttonWidth, buttonHeight);

            this.homeButton = new UIButton(homeRect, null, "<<<", false, () => { this.currentPage = 0; this.updateLevelSelection(0); });
            this.prevButton = new UIButton(prevRect, null, "<<", false, () => { this.currentPage = clamp(this.currentPage - 1, 0, this.totalPages - 1); this.updateLevelSelection(0); });
            this.nextButton = new UIButton(nextRect, null, ">>", false, () => { this.currentPage = clamp(this.currentPage + 1, 0, this.totalPages - 1); this.updateLevelSelection(0); });
            this.endButton = new UIButton(endRect, null, ">>>", false, () => { this.currentPage = this.totalPages - 1; this.updateLevelSelection(0); });

            this.buttons.push(this.homeButton);
            this.buttons.push(this.prevButton);
            this.buttons.push(this.nextButton);
            this.buttons.push(this.endButton);

            this.navigationButtonsInitialized = true;
        }
        else {
            if (this.homeButton) this.homeButton.enabled = this.currentPage !== 0 && this.totalPages > 1;
            if (this.prevButton) this.prevButton.enabled = this.currentPage !== 0 && this.totalPages > 1;
            if (this.nextButton) this.nextButton.enabled = this.totalPages > this.currentPage + 1;
            if (this.endButton) this.endButton.enabled = this.currentPage !== this.totalPages - 1;
        }

        // Draw the pagination stats
        ctx.fillStyle = "#efefef";
        ctx.fillRect(this.levelRects[1].left - offset.x - 1, this.levelRects[1].bottom - offset.y + 1, buttonWidth * 2 + 2, buttonHeight);
        ctx.strokeRect(this.levelRects[1].left - offset.x - 1, this.levelRects[1].bottom - offset.y + 1, buttonWidth * 2 + 2, buttonHeight);
        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        const oldBaseline = ctx.textBaseline;
        ctx.textBaseline = "middle";
        ctx.font = "14px Arial";

        const first = this.firstLevelOnPage(this.currentPage);
        const last = this.lastLevelOnPage(this.currentPage);
        const text = (first !== last) ? `Levels ${first}-${last} of ${this.levelList.length}` : `Level ${first} of ${this.levelList.length}`;
        ctx.fillText(text, this.levelRects[1].horizontalCenter - offset.x, this.levelRects[1].bottom - offset.y + buttonHeight / 2 + 2);
        ctx.textBaseline = oldBaseline;

        // Draw the levels


        if (this.selectorType === "save" && this.currentPage === 0) {
            // Draw the first entry as an empty, "new level" icon only
            const img = images["new_level"];
            ctx.drawImage(img, Math.floor(this.levelRects[0].left - offset.x + (this.levelRects[0].width - img.width) / 2),
                               Math.floor(this.levelRects[0].top - offset.y + (this.levelRects[0].height - img.height) / 2) + 5);
        }

        const oldFont = ctx.font;

        // -1 as the numbers returned are human-readable
        for (let i = this.firstLevelOnPage(this.currentPage) - 1; i <= this.lastLevelOnPage(this.currentPage) - 1; i++) {
            const rectIndex = this.rectIndexFromLevelIndex(i);
            let level = this.levelList[i];
            let levelBricks = generateEmptyBrickArray(this.settings);
            loadBricksFromLevelText(level.leveltext, levelBricks, this.settings);
            this.drawLevelThumbnail(offset, this.levelRects[rectIndex], ctx, levelBricks, images);

            let y = 2 * this.padding;
            ctx.font = "14px Arial";
            ctx.fillStyle = "black";
            ctx.textAlign = "center";
            ctx.fillText(`By ${level.author}`, this.levelRects[rectIndex].horizontalCenter - offset.x, 66);
            ctx.font = "18px Arial";

            // TODO: test with too many lines AND too long words!
            // TODO: center vertically? Keep in mind separate centering is required for each case: 1 line or 2 lines
            let lines = wrapText(ctx, level.name, this.levelRects[rectIndex].width - 6 * this.padding);
            for (let line of lines.slice(0,2)) {
                ctx.fillText(line, this.levelRects[rectIndex].horizontalCenter - offset.x, y)
                y += parseInt(ctx.font) + 4;
            }
        }

        ctx.textAlign = "left";
        ctx.font = oldFont;
    }

    // Helper methods
    // Most of these have a special case: the first page for saving has 2 level entries, all other pages 3,
    // due to the "new level" icon being present there.
    // For loading, every page has 3 entries and so the math is easier.
    private numLevelsOnPage(pageNumber: number) {
        return (pageNumber === 0 && this.selectorType === "save") ? Math.min(2, this.levelList.length) : Math.min(3, this.levelList.length);
    }

    // Note: human-readable numbers, so the first page has levels 1 and 2, the second page 3, 4, 5 etc.
    private firstLevelOnPage(pageNumber: number) {
        if (pageNumber === 0)
            return 1;
        else if (this.selectorType === "save")
            return 3 * pageNumber;
        else
            return 1 + 3 * pageNumber;
    }

    // Note: human-readable numbers, so the first page has levels 1 and 2, the second page 3, 4, 5 etc.
    private lastLevelOnPage(pageNumber: number) {
       if (pageNumber === 0 && this.selectorType === "save")
            return Math.min(2, this.levelList.length);
        else if (this.selectorType === "save")
            return Math.min(2 + 3 * pageNumber, this.levelList.length);
        else
            return Math.min(3 * (pageNumber + 1), this.levelList.length);
    }

    // In which level slot (0 - 2) should we draw the level with this index?
    private rectIndexFromLevelIndex(index: number) {
        // For page 0: index 1 and 2 are valid
        // For other pages: indexes 0, 1, 2 are valid
        // 0 -> 1, 1 -> 2; after that: 2 -> 0, 3 -> 1, 4 -> 2, 5 -> 0, 6 -> 1, 7 -> 2, 8 -> 0, ...
        if (index <= 1)
            return index + 1;
        else
            return (index - 2) % 3;
    }

    // If the rect of level slot 0 - 2 was clicked, which level was just selected?
    private levelIndexFromRectIndex(page: number, rectIndex: number) {
        if (this.selectorType === "save" && page === 0 && rectIndex === 0)
            throw new Error("Invalid values in levelIndexFromRectIndex");
        else if (this.selectorType === "save")
        // page 0: 1 -> level 0, 2 -> level 1; other pages: 0 -> level 2, 1 -> level 3, 2 -> level 4,  ///  0 -> level 5
            return (this.currentPage === 0) ? rectIndex - 1 : 2 + ((page - 1) * 3) + rectIndex;
        else
            return 1;
    }

    private updateLevelSelection(rectIndex: number) {
        this.selectedRect = rectIndex as (0 | 1 | 2);
        if (this.selectorType === "save" && this.currentPage === 0 && rectIndex === 0)
            this.levelName = "Untitled";
        else // For both save and load, in every other case
            this.levelName = this.levelList[this.levelIndexFromRectIndex(this.currentPage, rectIndex)].name;
    }

    private selectedLevel() {
        if (this.levelList.length === 0 || (this.selectorType === "save" && this.currentPage === 0 && this.selectedRect === 0))
            return null;
        else
            return this.levelList[this.levelIndexFromRectIndex(this.currentPage, this.selectedRect)];
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
        for (let button of this.buttons) {
            // Handle the fact that the Rect position is drawn relative to the window's top left, but the cursor is in global coordinates...
            let offsetCursor = _.clone(this.cursor);
            offsetCursor.x -= this.pos.x;
            offsetCursor.y -= this.pos.y;
            if (button.rect.isInsideRect(offsetCursor) && button.enabled) {
                button.clickCallback(true);
                return;
            }
        }

        for (let i = 0; i < this.levelRects.length; i++) {
            const isNewLevel = (this.selectorType === "save" && this.currentPage === 0 && i === 0);
            if (this.levelRects[i].isInsideRect(this.cursor) && (isNewLevel || (this.levelIndexFromRectIndex(this.currentPage, i) < this.levelList.length))) {
                this.updateLevelSelection(i);
                return;
            }
        }
    }
    onmouseup(e: MouseEvent) {
    }
    keyUp(ev: KeyboardEvent) {
    }
    keyDown(ev: KeyboardEvent) {
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
