import _ from "lodash";
import { BrickOrEmpty } from "../Brick";
import { Settings } from "../Settings";
import { clamp, createConfirmationDialog, deleteLevel, drawCoordsFromBrickCoords, generateEmptyBrickArray, LevelMetadata, loadBricksFromLevelText, Rect, UIButton, userId, userMayModifyLevel, wrapText } from "../Utils";
import { Vec2 } from "../Vec2";
import { WindowManager } from "../WindowManager";
import { LoadingScreen } from "./LoadingScreen";

// BEWARE: This code is by FAR the worst in this codebase as of when it's being written.
// I don't have the patience to write a proper windowing system for a single dialog, so this is FULL of
// horrifying hacks that I'm ashamed to have created.

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
    deleteButtons: UIButton[] = []; // One for each rect

    // levelList is filtered when saving, to only show levels the current user can overwrite.
    levelList: LevelMetadata[];
    fullLevelList: LevelMetadata[];
    currentPage: number = 0;
    totalPages: number = 1;
    selectedLevelBrickSource: BrickOrEmpty[][] = [];

    okCallback: ((metadataOrName: LevelMetadata | string) => void);
    cancelCallback: (() => void);
    readonly validCharacters: string[] = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789. +()[]{}-!?#%=".split("");
    readonly maxLevelnameLength = 28;
    readonly ourOkCallback = () => {
        if (this.okButton)
            this.okButton.enabled = false;

        if (this.selectorType === "load") {
            this.okCallback(this.selectedLevel()!);
            return;
        }

        const newLevel = this.currentPage === 0 && this.selectedRect === 0;
        if (newLevel)
            this.okCallback(this.levelName);
        else {
            let level = this.selectedLevel();
            if (level) {
                createConfirmationDialog(`Overwrite existing level "${level.name}"?\nThis cannot be undone.`, "Overwrite", "Cancel", this.settings, () => {
                    // Overwrite was clicked
                    WindowManager.getInstance().removeConfirmationDialog(this);

                    if (level) {
                        level.name = this.levelName;
                        this.okCallback(level);
                    }
                },
                () => {
                    // Cancel was clicked
                    WindowManager.getInstance().removeConfirmationDialog(this);
                });
            }
            else
                alert("BUG: selectedLevel() returned null");
        }
    };
    cursor: Vec2;
    buttons: UIButton[] = [];
    okButton: UIButton | null = null;
    cancelButton: UIButton | null = null;
    homeButton: UIButton | null = null;
    prevButton: UIButton | null = null;
    nextButton: UIButton | null = null;
    endButton: UIButton | null = null;

    // TODO: Remove later, when initializiation isn't a hack in the draw methods
    okCancelButtonsInitialized = false;
    navigationButtonsInitialized = false;

    // For loading: disabled if no valid level is selected
    // For saving: disabled if the name is already used, name is empty, or name is Untitled
    enableOkButton: boolean = false;
    enableCancelButton: boolean = true;

    constructor(type: "load" | "save", levelList: LevelMetadata[], initiallyHighlightLevel: LevelMetadata | null, settings: Settings,
                saveCallback: (selectedLevel: LevelMetadata | string) => void, cancelCallback: () => void, allowCancel: boolean = true) {
        this.windowTitle = (type === "load") ? "Load level" : "Save level";
        this.fullLevelList = _.clone(levelList);
        this.settings = settings;
        this.cursor = WindowManager.getInstance().getCursor();
        this.pos = new Vec2(Math.floor((this.settings.canvasWidth - this.width) / 2), Math.floor((this.settings.canvasHeight - this.height) / 2));
        if (type === "save")
            this.levelName = "Untitled";
        else
            this.levelName = "";
        this.selectorType = type;

        this.enableCancelButton = allowCancel;

        this.okCallback = saveCallback;
        this.cancelCallback = cancelCallback;

        if (this.selectorType === "load")
            this.selectedLevelBrickSource = generateEmptyBrickArray(this.settings);

        this.levelList = (this.selectorType === "load") ? levelList : levelList.filter(lev => userMayModifyLevel(lev));

        this.levelListUpdated();

        // If we were editing a level, pre-select that again now.
        let rectToSelect = 0;
        if (initiallyHighlightLevel) {
            const index = this.levelList.findIndex(lev => lev.level_id === initiallyHighlightLevel.level_id);
            if (index >= 0) {
                this.currentPage = this.pageFromLevelIndex(index);
                rectToSelect = this.rectIndexFromLevelIndex(index);
            }
        }

        this.updateLevelSelection(rectToSelect);
    }

    levelListUpdated() {
        if (this.selectorType === "load")
            this.totalPages = Math.ceil(this.levelList.length / 3);
        else {
            // Handle the offset due to the "New level" icon taking up one slot on the first page
            if (this.levelList.length < 2)
                this.totalPages = 1;
            else
                this.totalPages = Math.ceil((this.levelList.length - 2) / 3) + 1;
        }

        this.currentPage = clamp(this.currentPage, 0, this.totalPages - 1);

        // Also "clamp" the selection to something valid
        if (!(this.selectorType === "save" && this.currentPage === 0 && this.selectedRect === 0) &&
            this.levelIndexFromRectIndex(this.currentPage, this.selectedRect) >= this.levelList.length)
            this.updateLevelSelection(this.selectedRect - 1);
        else if (this.selectorType === "load")
            this.updateLevelSelection(this.selectedRect); // Ensure the preview thumbnail always matches the selected level (needed on level delete)
    }

    draw(ctx: CanvasRenderingContext2D, editorBrickSource: BrickOrEmpty[][], images: Record<string, HTMLImageElement>): boolean {
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
        const brickSource = (this.selectorType === "load") ? this.selectedLevelBrickSource : editorBrickSource;
        this.drawLevelPreview(ctx, brickSource, images, previewSettings, new Vec2(this.padding, levelPreviewY));

        // Label, textedit, buttons
        ctx.beginPath();
        const levelNameY = levelPreviewY + 344 + 2 * this.padding + 2;
        const labelText = "Level name: ";
        const {width} = ctx.measureText(labelText);
        const old = ctx.textBaseline;
        ctx.fillStyle = "#fdfdfd";
        if (this.selectorType === "save") {
            // Draw this as a TextEdit-ish control
            ctx.fillRect(2 * this.padding + width, levelNameY, 405, parseInt(ctx.font) + this.padding);
            ctx.strokeRect(2 * this.padding + width, levelNameY, 405, parseInt(ctx.font) + this.padding);
        }

        ctx.textBaseline = "middle";
        ctx.fillStyle = "black";
        const textY = levelNameY + parseInt(ctx.font)/2 + this.padding/2;
        ctx.fillText(labelText, this.padding, textY);
        ctx.fillStyle = "black";
        const reallyFakeCursor = (this.selectorType === "save") ? "_" : "";
        ctx.fillText(this.levelName + reallyFakeCursor, 3 * this.padding + width, textY);

        ctx.textBaseline = old;

        if (this.selectorType === "load")
            this.enableOkButton = true;
        else {
            const nameUsedByOtherLevel = this.fullLevelList.some(lev => lev.level_id !== this.selectedLevel()?.level_id && lev.name.trim() === this.levelName.trim());

            this.enableOkButton = (this.levelName.length > 0 && this.levelName != "Untitled") &&
                                !nameUsedByOtherLevel;
        }

        // Create the buttons, hacky right alignment
        if (!this.okCancelButtonsInitialized) {
            const buttonWidth = 80;
            const buttonHeight = 20;
            const cancelRect = new Rect(this.width - this.padding - buttonWidth, levelNameY, buttonWidth, buttonHeight);
            const okRect = new Rect(this.width - this.padding - 2 * buttonWidth - 2 * this.padding, levelNameY, buttonWidth, buttonHeight);

            const text = (this.selectorType === "load") ? "Load" : "Save";
            this.okButton = new UIButton(okRect, null, text, this.enableOkButton, false, this.ourOkCallback);
            this.cancelButton = new UIButton(cancelRect, null, "Cancel", this.enableCancelButton, false, (_: UIButton) => {
                this.cancelCallback();
            });

            this.buttons.push(this.okButton);
            this.buttons.push(this.cancelButton);
            this.okCancelButtonsInitialized = true;
        }
        else {
            if (this.okButton)
                this.okButton.enabled = this.enableOkButton;
            if (this.cancelButton)
                this.cancelButton.enabled = this.enableCancelButton;
        }

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

            this.homeButton = new UIButton(homeRect, null, "<<<", false, false, () => { this.currentPage = 0; this.updateLevelSelection(0); });
            this.prevButton = new UIButton(prevRect, null, "<<", false, false, () => { this.currentPage = clamp(this.currentPage - 1, 0, this.totalPages - 1); this.updateLevelSelection(0); });
            this.nextButton = new UIButton(nextRect, null, ">>", false, false, () => { this.currentPage = clamp(this.currentPage + 1, 0, this.totalPages - 1); this.updateLevelSelection(0); });
            this.endButton = new UIButton(endRect, null, ">>>", false, false, () => { this.currentPage = this.totalPages - 1; this.updateLevelSelection(0); });

            this.buttons.push(this.homeButton);
            this.buttons.push(this.prevButton);
            this.buttons.push(this.nextButton);
            this.buttons.push(this.endButton);

            // Also create delete buttons for each of the three "level rects"
            for (let i = 0; i < this.levelRects.length; i++) {
                const levelRect = this.levelRects[i];
                const img = images["icon_trash"];
                const deleteRect = new Rect(levelRect.right - offset.x - img.width, levelRect.top - offset.y + this.padding + wtf, img.width, img.height);
                const button = new UIButton(deleteRect, "icon_trash", "Delete level", true, false, () => {
                    const levelIndex = this.levelIndexFromRectIndex(this.currentPage, i);
                    let level = this.levelList[levelIndex];
                    createConfirmationDialog(`Delete level "${level.name}"?\nThis cannot be undone.`, "Delete", "Cancel", this.settings, () => {
                        // Delete was clicked
                        WindowManager.getInstance().removeConfirmationDialog(this);
                        this.deleteLevel(level);
                    },
                    () => {
                        // Cancel was clicked
                        WindowManager.getInstance().removeConfirmationDialog(this);
                    });
                });

                this.buttons.push(button);
                this.deleteButtons.push(button);
            }

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

        const first = Math.min(this.firstLevelOnPage(this.currentPage), this.levelList.length);
        const last = this.lastLevelOnPage(this.currentPage);
        const text = (first !== last) ? `Levels ${first}-${last} of ${this.levelList.length}` : `Level ${first} of ${this.levelList.length}`;
        ctx.fillText(text, this.levelRects[1].horizontalCenter - offset.x, this.levelRects[1].bottom - offset.y + buttonHeight / 2 + 2);
        ctx.textBaseline = oldBaseline;

        // Draw the levels

        // Those that should be visible are updated below
        for (let i = 0; i < this.deleteButtons.length; i++)
            this.deleteButtons[i].hidden = true;

        if (this.selectorType === "save" && this.currentPage === 0) {
            // Draw the first entry as an empty, "new level" icon only
            const img = images["new_level"];
            ctx.drawImage(img, Math.floor(this.levelRects[0].left - offset.x + (this.levelRects[0].width - img.width) / 2),
                               Math.floor(this.levelRects[0].top - offset.y + (this.levelRects[0].height - img.height) / 2) + 5);
        }
        else if (this.deleteButtons.length > 0)
            this.deleteButtons[0].hidden = !this.mayModifyLevelAtRectIndex(0);

        const oldFont = ctx.font;

        // -1 as the numbers returned are human-readable
        for (let i = this.firstLevelOnPage(this.currentPage) - 1; i <= this.lastLevelOnPage(this.currentPage) - 1; i++) {
            const rectIndex = this.rectIndexFromLevelIndex(i);
            let level = this.levelList[i];
            let levelBricks = generateEmptyBrickArray(this.settings);
            loadBricksFromLevelText(level.leveltext, levelBricks, this.settings);
            this.drawLevelThumbnail(offset, this.levelRects[rectIndex], ctx, levelBricks, images);

            this.deleteButtons[rectIndex].hidden = !this.mayModifyLevelAtRectIndex(rectIndex);

            let y = 2 * this.padding;
            ctx.font = "14px Arial";
            ctx.fillStyle = "black";
            ctx.textAlign = "center";
            ctx.fillText(`By ${level.author}`, this.levelRects[rectIndex].horizontalCenter - offset.x, 66);
            ctx.font = "18px Arial";

            // TODO: test with too many lines AND too long words!
            // TODO: center vertically? Keep in mind separate centering is required for each case: 1 line or 2 lines
            let lines = wrapText(ctx, level.name, this.levelRects[rectIndex].width - 2 * this.padding - this.deleteButtons[0].rect.width);
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

    // On which page (0-indexed) is this level located?
    private pageFromLevelIndex(index: number) {
        if (this.selectorType === "load")
            return Math.floor(index / 3);
        else if (index <= 1)
            return 0; // Take care of "New level" offset
        else
            return Math.floor((index - 2) / 3) + 1;
    }

    // In which level slot (0 - 2) should we draw the level with this index?
    private rectIndexFromLevelIndex(index: number) {
        if (this.selectorType === "load") {
            return index % 3;
        }

        // Else we are saving, take care of the offset due to the "New level" icon taking the first slot on page 1
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
            return (page === 0) ? rectIndex - 1 : 2 + ((page - 1) * 3) + rectIndex;
        else
            return page * 3 + rectIndex;
    }

    // Decides whether the delete icon will be visible or not, and whether these levels will be visible in the save dialog.
    // Note that the backend enforces these checks regardless of what the client does or claims.
    private mayModifyLevelAtRectIndex(rectIndex: number) {
        if (userId() === undefined)
            return false;

        const levelIndex = this.levelIndexFromRectIndex(this.currentPage, rectIndex);
        const level = this.levelList[levelIndex];
        return userMayModifyLevel(level);
    }

    private updateLevelSelection(rectIndex: number) {
        this.selectedRect = rectIndex as (0 | 1 | 2);
        if (this.selectorType === "save" && this.currentPage === 0 && rectIndex === 0)
            this.levelName = "Untitled";
        else // For both save and load, in every other case
            this.levelName = this.levelList[this.levelIndexFromRectIndex(this.currentPage, rectIndex)].name;

        if (this.selectorType === "load") {
            const level = this.selectedLevel();
            if (!level)
                return;
            loadBricksFromLevelText(level.leveltext, this.selectedLevelBrickSource, this.settings);
        }
    }

    private selectedLevel() {
        if (this.levelList.length === 0 || (this.selectorType === "save" && this.currentPage === 0 && this.selectedRect === 0))
            return null;
        else
            return this.levelList[this.levelIndexFromRectIndex(this.currentPage, this.selectedRect)];
    }

    private deleteLevel(level: LevelMetadata) {
        let loadingScreen = new LoadingScreen(`Deleting level "${level.name}"...`, this.settings);
        WindowManager.getInstance().addWindow(loadingScreen, true);

        const id = level.level_id;

        deleteLevel(level).then(json => {
            WindowManager.getInstance().removeLoadingScreen(this);

            if ("type" in json && json.type === "error")
                alert("Level deletion failed: " + json.message);
            else {
                this.levelList = this.levelList.filter(l => l.level_id !== id);
                this.levelListUpdated();
                alert("The level was deleted."); // TODO: Change to something less annoying than an alert!
            }
        }).catch(reason => {
            WindowManager.getInstance().removeLoadingScreen(this);
            alert("Level deletion failed: " + reason.message);
        });
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
            if (button.rect.isInsideRect(offsetCursor) && button.enabled && !button.hidden) {
                button.clickCallback(button);
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
        if (this.selectorType === "save" && (ev.key == "Delete" || ev.key == "Backspace") && this.levelName.length > 0)
            this.levelName = this.levelName.substring(0, this.levelName.length - 1);
        else if (ev.key == "Enter" && this.enableOkButton) {
            this.ourOkCallback();
        }
        else if (ev.key == "Escape" && this.enableCancelButton) {
            ev.preventDefault();
            this.cancelCallback();
        }
        else if (this.selectorType === "save" && this.validCharacters.includes(ev.key) && this.levelName.length < this.maxLevelnameLength)
            this.levelName += ev.key;
        else
            console.log("Invalid key: " + ev.key);
    }
}
