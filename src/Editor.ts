import _, { flatten } from "lodash";
import { Brick, BrickOrEmpty } from "./Brick";
import { Game } from "./Game";
import { Settings } from "./Settings";
import { LevelSelector } from "./UI/LevelSelector";
import { brickCoordsFromDrawCoords, calculateSymmetricPositions, clearBrickArray, copyBrickArray, createConfirmationDialog, createLoadingScreen, drawCoordsFromBrickCoords, fetchLevelIndex, generateEmptyBrickArray, generateLevelTextFromBricks, levelCenter, LevelMetadata, loadBricksFromLevelText, Rect, snapSymmetryCenter, UIButton, UIElement, UIHorizontalSeparator, uploadLevel, userId, validBrickPosition } from "./Utils";
import { BrickPosition, Vec2 } from "./Vec2";
import { AcceptsInput, WindowManager } from "./WindowManager";

export class Editor implements AcceptsInput {
    game: Game;
    settings: Settings;
    cursor: Vec2;
    emptyLevelText: string;
    brickPalette: string[] = ["_delete", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "_indestructible"];

    bricks: (Brick | undefined)[][] = [];
    mostRecentlyLoadedLevel: LevelMetadata | null = null;
    changesMade: boolean = false;

    // Drag stuff
    currentlyDragging: boolean = false;
    bricksBeforeDrag: (Brick | undefined)[][] = [];
    dragStartPos: BrickPosition = new BrickPosition();
    lastDragPos: BrickPosition = new BrickPosition();

    marqueeActive: boolean = false;
    marqueeStart: Vec2 | undefined;

    activeBrick: string = "brick1";

    leftButtonDown: boolean = false;
    rightButtonDown: boolean = false;
    shiftDown: boolean = false;
    altDown: boolean = false;
    ctrlDown: boolean = false;

    toolbarButtons: UIElement[] = [];
    verticalSymmetry: boolean = false;
    horizontalSymmetry: boolean = false;
    setSymmetryCenter: boolean = false;
    shouldDrawGrid: boolean = false;
    symmetryCenter: Vec2 = new Vec2();
    symmetryCenterButton: UIButton | undefined;
    marqueeButton: UIButton | undefined;

    // Level selector/UI stuff
    levelSelector: LevelSelector | null = null;

    constructor(game: Game, settings: Settings) {
        this.game = game;
        this.settings = settings;
        this.cursor = WindowManager.getInstance().getCursor();
        this.emptyLevelText = (".".repeat(this.settings.levelWidth) + "\n").repeat(this.settings.levelHeight);

        this.setupToolbarButtons();

        this.clearLevel();

        this.testLogin();
    }

    testLogin() {
        let formData = new FormData();
        formData.append("action", "testlogin");
        fetch('/game/level_upload.php', {
                method: "POST",
                cache: 'no-cache',
                body: formData
        })
        .then(response => response.json())
        .then(json => {
            // Fetch the campaign level with the lowest levelnumber
            if (!("type" in json && json.type === "success"))
                alert("Warning: you are not logged in, and won't be able to save your level! Please click the login link below the editor area and reload the page once logged in.");
        })
        .catch(error => {
            alert("Failed to check login status: " + error);
        });
    }

    showLoadDialog() {
        // Set up callbacks first...
        const loadCallback = (selectedLevel: LevelMetadata | string) => {
            // Should never, ever happen for loading, but the compiler doesn't realize that.
            if (typeof selectedLevel === "string") return;

            WindowManager.getInstance().removeWindow(this.levelSelector);
            WindowManager.getInstance().setActiveWindow(this);
            this.levelSelector = null;
            this.loadLevelText(selectedLevel.leveltext);
            this.mostRecentlyLoadedLevel = selectedLevel;
        };
        const cancelCallback = () => {
            WindowManager.getInstance().removeWindow(this.levelSelector);
            WindowManager.getInstance().setActiveWindow(this);
            this.levelSelector = null;
        };

        createLoadingScreen("Loading level list...", this.settings);

        fetchLevelIndex("standalone", (levels: LevelMetadata[]) => {
            // Success callback
            WindowManager.getInstance().removeLoadingScreen(this);
            this.levelSelector = new LevelSelector("load", levels, this.mostRecentlyLoadedLevel, this.settings, loadCallback, cancelCallback);
            WindowManager.getInstance().addWindow(this.levelSelector, true);
        }, () => {
            // Failure callback
            WindowManager.getInstance().removeLoadingScreen(this);
        });
    }

    showSaveDialog() {
        // Only logged in users can save ANY level. Permission checks for whether they can overwrite existing levels are made later.
        if (userId() === undefined) {
            alert("You are not logged in! Please log in (in a separate browser tab) and try again.");
            return;
        }

        // Set up callbacks first...
        const saveCallback = (selectedLevel: LevelMetadata | string) => {
            WindowManager.getInstance().removeWindow(this.levelSelector);
            WindowManager.getInstance().setActiveWindow(this);
            const newLevelText = generateLevelTextFromBricks(this.bricks, this.settings);

            // Ensure we can update leveltext without the Save dialog thumbnail updating -- otherwise, it will update prior to the upload
            // finishing, and even if the upload fails
            selectedLevel = _.clone(selectedLevel);

            if (typeof selectedLevel === "string") {
                // This is a new level
                // level_id and author are assigned/set, respectively, by the backend
                const name = selectedLevel;
                selectedLevel = { level_id: 0, name: name, type: "standalone", levelnumber: 0, leveltext: newLevelText, author: "" } as LevelMetadata;
            }
            else {
                // This is an old level that we should update (and possibly rename)
                // Make sure to use the ID
                selectedLevel.leveltext = newLevelText;
            }

            createLoadingScreen("Uploading level...", this.settings);

            // Note: this uses a Promise returned by fetch, so this code
            // is asynchronous and will most likely finish *after* we return from this method.
            uploadLevel(selectedLevel).then(json => {
                WindowManager.getInstance().removeLoadingScreen(this);

                if ("type" in json && json.type === "error")
                    alert("Level upload failed: " + json.message);
                else {
                    alert("Level upload successful!"); // TODO: Change to something less annoying than an alert!
                    this.levelSelector = null;
                    this.changesMade = false;
                }
            }).catch(reason => {
                WindowManager.getInstance().removeLoadingScreen(this);
                alert("Level upload failed: " + reason.message);
            });
        }
        const cancelCallback = () => {
            WindowManager.getInstance().removeWindow(this.levelSelector);
            WindowManager.getInstance().setActiveWindow(this);
            this.levelSelector = null;
        }

        createLoadingScreen("Loading level list...", this.settings);

        fetchLevelIndex("standalone", (levels: LevelMetadata[]) => {
            // Success callback
            WindowManager.getInstance().removeLoadingScreen(this);
            this.levelSelector = new LevelSelector("save", levels, this.mostRecentlyLoadedLevel, this.settings, saveCallback, cancelCallback);
            WindowManager.getInstance().addWindow(this.levelSelector, true);
        }, () => {
            // Failure callback
            WindowManager.getInstance().removeLoadingScreen(this);
        });
    }

    newLevel() {
        if (this.changesMade) {
            createConfirmationDialog("Discard changes and create a new level?\nYour changes won't be saved.", "New level", "Cancel", this.settings, () => {
                WindowManager.getInstance().removeConfirmationDialog(this);
                this.clearLevel();
            }, () => {
                WindowManager.getInstance().removeConfirmationDialog(this);
            });
        }
        else
            this.clearLevel();
    }

    loadLevel() {
        if (this.changesMade) {
            createConfirmationDialog("Discard changes and load a different level?\nYour changes won't be saved.", "Load level", "Cancel", this.settings, () => {
                WindowManager.getInstance().removeConfirmationDialog(this);
                this.showLoadDialog();
            }, () => {
                WindowManager.getInstance().removeConfirmationDialog(this);
            });
        }
        else
            this.showLoadDialog();
    }

    clearLevel() {
        this.bricks.length = 0;
        this.bricks = generateEmptyBrickArray(this.settings);
        this.bricksBeforeDrag = generateEmptyBrickArray(this.settings);
        this.loadLevelText(this.emptyLevelText);
        this.mostRecentlyLoadedLevel = null;
    }

    loadLevelText(levelText: string) {
        loadBricksFromLevelText(levelText, this.bricks, this.settings);
        this.changesMade = false;
        this.symmetryCenter = new Vec2(levelCenter("x", this.settings), levelCenter("y", this.settings));
    }

    setupToolbarButtons() {
        const x = this.settings.canvasWidth;
        let y = 4;

        this.toolbarButtons.push(new UIButton(new Rect(x, y, 48, 48), "icon_new", "New level", false, true, (button: UIButton) => {
            this.newLevel();
            button.enabled = false;
        }));
        y += 48;

        // TODO: This is a bit weird -- it asks if you want to discard changes, but if the load dialog is opened and then cancelled, nothing really changes.
        // TODO: It should perhaps warn at a later stage, when actually loading?
        this.toolbarButtons.push(new UIButton(new Rect(x, y, 48, 48), "icon_load", "Load level (Ctrl+L)", false, true, (button: UIButton) => {
            this.loadLevel();
            button.enabled = false;
        }));
        y += 48;

        this.toolbarButtons.push(new UIButton(new Rect(x, y, 48, 48), "icon_save", "Save level (Ctrl+S)", false, true, (button: UIButton) => {
            this.showSaveDialog();
            button.enabled = false;
        }));
        y += 48;

        y += 6;
        this.toolbarButtons.push(new UIHorizontalSeparator(new Rect(x, y, 48, 2)));
        y += 6 + 2; // 6 spacing, 2 for the separator itself

        this.toolbarButtons.push(new UIButton(new Rect(x, y, 48, 48), "icon_marquee", "Rectangular marquee", false, true, (button: UIButton) => {
            this.marqueeActive = button.enabled;
        }));
        this.marqueeButton = this.toolbarButtons[this.toolbarButtons.length - 1] as UIButton;
        y += 48;

        this.toolbarButtons.push(new UIButton(new Rect(x, y, 48, 48), "icon_grid", "Show grid", false, true, (button: UIButton) => {
            this.shouldDrawGrid = button.enabled;
        }));
        y += 48;

        this.toolbarButtons.push(new UIButton(new Rect(x, y, 48, 48), "icon_hsymmetry", "Horizontal symmetry", false, true, (button: UIButton) => {
            this.horizontalSymmetry = button.enabled;
        }));
        y += 48;

        this.toolbarButtons.push(new UIButton(new Rect(x, y, 48, 48), "icon_vsymmetry", "Vertical symmetry", false, true, (button: UIButton) => {
            this.verticalSymmetry = button.enabled;
        }));
        y += 48;

        this.toolbarButtons.push(new UIButton(new Rect(x, y, 48, 48), "icon_symmetry_center", "Set symmetry centerpoint", false, true, (button: UIButton) => {
            this.setSymmetryCenter = button.enabled;
        }));
        y += 48;
        this.symmetryCenterButton = this.toolbarButtons[this.toolbarButtons.length - 1] as UIButton;

        y += 6;
        this.toolbarButtons.push(new UIHorizontalSeparator(new Rect(x, y, 48, 2)));
        y += 6 + 2; // 6 spacing, 2 for the separator itself

        this.toolbarButtons.push(new UIButton(new Rect(x, y, 48, 48), "icon_return", "Exit back to game (Ctrl+X)", false, true, (button: UIButton) => {
            this.game.exitEditor();
            button.enabled = false;
        }));
    }

    selectBrickAtCursor(selectOrDeselect: "select" | "deselect" = "select") {
        let brick = this.getBrickAtCursor();
        if (!brick)
            return;

        brick.selected = (selectOrDeselect === "select") ? true : false;
    }

    deselectBrickAtCursor() {
        this.selectBrickAtCursor("deselect");
    }

    selectAll(x: "select" | "deselect" = "select") {
        for (let brick of flatten(this.bricks)) {
            if (brick)
                brick.selected = (x === "select");
        }
    }

    deselectAll() {
        this.selectAll("deselect");
    }

    deleteSelectedBlocks() {
        for (let y = 0; y < this.bricks.length; y++) {
            for (let x = 0; x < this.bricks[0].length; x++) {
                if (this.bricks[y][x]?.selected)
                    this.bricks[y][x] = undefined;
                    this.changesMade = true;
            }
        }
    }

    brickPositionAtCursor(): BrickPosition | null {
        if (this.cursor.y >= this.settings.paletteY - this.settings.brickHeight - 2 * this.settings.brickSpacing)
            return null;

        const x = brickCoordsFromDrawCoords("x", this.cursor.x, this.settings);
        const y = brickCoordsFromDrawCoords("y", this.cursor.y, this.settings);

        return new BrickPosition(x, y);
    }

    getBrickAtCursor(): Brick | null {
        let pos = this.brickPositionAtCursor();
        if (!pos) return null;
        return (this.bricks[pos.y][pos.x] !== undefined) ? this.bricks[pos.y][pos.x]! : null;
    }

    placeBrickAtCursor(rightClick: boolean = false) {
        const pos = this.brickPositionAtCursor();
        if (!pos)
            return;

        for (let symmetricPosition of calculateSymmetricPositions(pos, this.symmetryCenter, this.horizontalSymmetry, this.verticalSymmetry, this.settings)) {
            if (validBrickPosition(symmetricPosition, this.settings))
                this.placeBrickAtPosition(symmetricPosition, (this.activeBrick === "brick_delete" || rightClick));
        }
    }

    placeBrickAtPosition(pos: BrickPosition, shouldDelete: boolean) {
        const drawCoords = new Vec2(drawCoordsFromBrickCoords("x", pos.x, this.settings), drawCoordsFromBrickCoords("y", pos.y, this.settings));
        if (shouldDelete)
            this.bricks[pos.y][pos.x] = undefined;
        else
            this.bricks[pos.y][pos.x] = new Brick(drawCoords, this.activeBrick, this.settings, 10, 1, this.activeBrick?.includes("_indestructible"));

        this.changesMade = true;
    }

    dragMoved() {
        // Restore the original layout, then copy all selected bricks with the same offset as the selected brick.
        // Bricks that end up outside of the game area are ignored.
        const pos = this.brickPositionAtCursor();
        if (!pos)
            return;
        if (pos.x === this.lastDragPos.x && pos.y === this.lastDragPos.y)
            return;

        this.lastDragPos = pos;
        const dragOffset = new BrickPosition(this.lastDragPos.x - this.dragStartPos.x, this.lastDragPos.y - this.dragStartPos.y);

        if (dragOffset.x === 0 && dragOffset.y === 0) {
            copyBrickArray(this.bricksBeforeDrag, this.bricks, true, true);
            return;
        }

        this.changesMade = true;

        // Step 1: copy UNSELECTED bricks that should remain where they are
        clearBrickArray(this.bricks);
        copyBrickArray(this.bricksBeforeDrag, this.bricks, false, true);

        // Step 2: find all bricks that were SELECTED when the drag started, and copy them to their new position
        for (let y = 0; y < this.settings.levelHeight; y++) {
            for (let x = 0; x < this.settings.levelWidth; x++) {
                if (this.bricksBeforeDrag[y][x]?.selected &&
                    x + dragOffset.x >= 0 &&
                    y + dragOffset.y >= 0 &&
                    x + dragOffset.x < this.settings.levelWidth &&
                    y + dragOffset.y < this.settings.levelHeight) {
                        // We need to both update this.bricks *AND* the Brick class itself, since that holds the position to draw it at!
                        const brick = this.bricksBeforeDrag[y][x]!.copy();
                        brick.setUpperLeft(new Vec2(drawCoordsFromBrickCoords("x", x + dragOffset.x, this.settings), drawCoordsFromBrickCoords("y", y + dragOffset.y, this.settings)));
                        this.bricks[y + dragOffset.y][x + dragOffset.x] = brick;
                }
            }
        }

        // Step 3: if ctrl is pressed, COPY instead of move. In other words, add the selected bricks back at their original locations
        if (this.ctrlDown) {
            copyBrickArray(this.bricksBeforeDrag, this.bricks, true, false, (b: BrickOrEmpty) => {
                if (b)
                    b.selected = false;
            });
        }
    }

    startDrag() {
        this.currentlyDragging = true;
        copyBrickArray(this.bricks, this.bricksBeforeDrag, true, true);
        this.dragStartPos = this.brickPositionAtCursor()!;
        this.lastDragPos = this.dragStartPos;
    }

    stopDrag() {
        this.currentlyDragging = false;
    }

    abortDrag() {
        if (this.currentlyDragging) {
            this.currentlyDragging = false;
            copyBrickArray(this.bricksBeforeDrag, this.bricks, true, true);
        }
    }

    updateMarquee() {
        const start = this.marqueeStart;
        const end = this.cursor;
        if (!start) {
            return;
        }

        const upperLeft = new Vec2(Math.min(start.x, end.x), Math.min(start.y, end.y));
        const bottomRight = new Vec2(Math.max(start.x, end.x), Math.max(start.y, end.y));

        // Select the blocks inside the rect -- we want to select every block that intersects at all.
        for (let brick of _.flatten(this.bricks)) {
            if (!brick)
                continue;

            if (new Rect(upperLeft.x, upperLeft.y, bottomRight.x - upperLeft.x, bottomRight.y - upperLeft.y).intersectsWith(
                new Rect(brick.upperLeft.x, brick.upperLeft.y, brick.bottomRight.x - brick.upperLeft.x, brick.bottomRight.y - brick.upperLeft.y)))
                {
                    brick.selected = true;
            }
            else {
                // TODO: Add other modes?
                brick.selected = false;
            }
        }
    }

    endMarquee() {
        this.marqueeActive = false;
        this.marqueeStart = undefined;
        if (this.marqueeButton)
            this.marqueeButton.enabled = false;
    }


    keyDown(ev: KeyboardEvent) {
        if (ev.shiftKey) this.shiftDown = true;
        if (ev.ctrlKey) this.ctrlDown = true;
        if (ev.altKey) { ev.preventDefault(); this.altDown = true; }
        if (ev.ctrlKey && (ev.key == "x" || ev.key == "X")) {
            // TODO: add checks about modified data / ask about saving etc.
            ev.preventDefault();
            this.game.exitEditor();
        }
        else if (ev.ctrlKey && (ev.key == "l" || ev.key == "L")) {
            ev.preventDefault();
            this.loadLevel();
        }
        else if (ev.ctrlKey && (ev.key == "s" || ev.key == "S")) {
            ev.preventDefault();
            this.showSaveDialog();
        }
        else if (ev.ctrlKey && (ev.key == "a" || ev.key == "A")) {
            ev.preventDefault();
            this.selectAll();
        }
        else if (ev.ctrlKey && (ev.key == "d" || ev.key == "D")) {
            ev.preventDefault();
            this.deselectAll();
        }
        else if (ev.key === "Delete") {
            this.deleteSelectedBlocks();
        }
    }

    keyUp(ev: KeyboardEvent) {
        if (!ev.shiftKey) this.shiftDown = false;
        if (!ev.ctrlKey) this.ctrlDown = false;
        if (!ev.altKey) { ev.preventDefault(); this.altDown = false; }
    }

    mouseMoved(e: MouseEvent) {
        if (this.marqueeActive && this.marqueeStart) {
            this.updateMarquee();
            return;
        }

        if (this.cursor.x < this.settings.canvasWidth && (this.leftButtonDown || this.rightButtonDown) && !this.setSymmetryCenter && !this.marqueeActive) {
            if (this.currentlyDragging)
                this.dragMoved();
            else if (this.shiftDown)
                this.selectBrickAtCursor();
            else if (this.altDown)
                this.deselectBrickAtCursor();
            else
                this.placeBrickAtCursor(this.rightButtonDown);
        }
    }

    onmouseup(e: MouseEvent) {
        if (e.button === 0)
            this.leftButtonDown = false;
        else if (e.button === 2)
            this.rightButtonDown = false;

        if (this.marqueeActive && this.marqueeStart) {
            this.endMarquee();
        }

        if (this.setSymmetryCenter && this.cursor.x < this.settings.canvasWidth && this.cursor.y < this.settings.paletteY) {
            this.symmetryCenter = snapSymmetryCenter(this.cursor, this.settings);
            this.setSymmetryCenter = false;
            if (this.symmetryCenterButton)
                this.symmetryCenterButton.enabled = false;
        }

        if (this.currentlyDragging)
            this.stopDrag();
    }

    onmousedown(e: MouseEvent) {
        if (e.button === 0)
            this.leftButtonDown = true;
        else if (e.button === 2)
            this.rightButtonDown = true;

        // Handle toolbar clicks
        if (this.cursor.x >= this.settings.canvasWidth) {
            for (let button of this.toolbarButtons) {
                if (!(button instanceof UIButton))
                    continue;

                if (button.rect.isInsideRect(this.cursor)) {
                    button.enabled = !button.enabled;
                    button.clickCallback(button);
                    return;
                }
            }

            // Return even if no button was clicked
            return;
         }

        if (this.marqueeActive) {
            this.marqueeStart = _.clone(this.cursor);
            return;
        }

        const index = brickCoordsFromDrawCoords("x", this.cursor.x, this.settings);
        if (this.cursor.y >= this.settings.paletteY && this.cursor.y < this.settings.paletteY + this.settings.brickHeight) {
            // Click is in the palette
            if (index < this.brickPalette.length)
                this.activeBrick = `brick${this.brickPalette[index]}`;

            // Change modes if necessary
            this.setSymmetryCenter = false;
            if (this.symmetryCenterButton)
                this.symmetryCenterButton.enabled = false;
        }
        else if (!this.setSymmetryCenter) {
            // Click is in the game area
            if (this.shiftDown)
                this.selectBrickAtCursor();
            else if (this.altDown)
                this.deselectBrickAtCursor();
            else if (this.getBrickAtCursor()?.selected) {
                this.startDrag();
            }
            else
                this.placeBrickAtCursor(e.button === 2);
        }
    }

    focusLost() {
        this.abortDrag();

        this.leftButtonDown = false;
        this.rightButtonDown = false;
        this.shiftDown = false;
        this.altDown = false;
        this.ctrlDown = false;
    }
}
