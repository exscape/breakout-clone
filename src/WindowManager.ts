import { Settings } from "./Settings";
import { ConfirmationDialog } from "./UI/ConfirmationDialog";
import { LoadingScreen } from "./UI/LoadingScreen";
import { clamp } from "./Utils";
import { Vec2 } from "./Vec2";

export interface AcceptsInput {
    keyDown?(ev: KeyboardEvent): void;
    keyUp?(ev: KeyboardEvent): void;
    mouseMoved?(e: MouseEvent): void;
    onmouseup?(e: MouseEvent): void;
    onmousedown?(e: MouseEvent): void;
    focusLost?(): void;
}

export class WindowManager implements AcceptsInput {
    private static instance: WindowManager;
    private constructor() {
        this.cursor = new Vec2();
    }

    knownWindows: Set<AcceptsInput> = new Set();
    activeWindow: AcceptsInput | null = null;
    settings: Settings | null = null;
    cursor: Vec2;
    cursorFrozen: boolean = true;

    maxWidth: number = 0;
    maxHeight: number = 0;

    public static getInstance() {
        if (!WindowManager.instance) {
            WindowManager.instance = new WindowManager();
        }

        return WindowManager.instance;
    }

    getCursor() {
        return this.cursor;
    }

    setSettings(settings: Settings) {
        this.settings = settings;
    }

    setMaxWidth(width: number) {
        if (this.maxWidth === 0)
            this.cursor.x = width / 2;
        this.maxWidth = width;
    }

    setMaxHeight(height: number) {
        if (this.maxHeight === 0)
            this.cursor.y = height / 2;
        this.maxHeight = height;
    }

    addWindow(window: AcceptsInput, setAsActive: boolean = false) {
        this.knownWindows.add(window);

        if (setAsActive)
            this.setActiveWindow(window);
    }

    removeWindow(window: AcceptsInput) {
        this.knownWindows.delete(window);
    }

    setActiveWindow(window: AcceptsInput) {
        this.activeWindow = window;
    }

    getLoadingScreen(): LoadingScreen | null {
        for (let window of this.knownWindows) {
            if (window instanceof LoadingScreen)
                return window;
        }

        return null;
    }

    removeLoadingScreen(newActiveWindow: AcceptsInput) {
        this.setActiveWindow(newActiveWindow);
        let window = this.getLoadingScreen();
        if (window)
            this.removeWindow(window);
    }

    getConfirmationDialog(): ConfirmationDialog | null {
        for (let window of this.knownWindows) {
            if (window instanceof ConfirmationDialog)
                return window;
        }

        return null;
    }

    removeConfirmationDialog(newActiveWindow: AcceptsInput) {
        this.setActiveWindow(newActiveWindow);
        let window = this.getConfirmationDialog();
        if (window)
            this.removeWindow(window);
    }

    keyDown(ev: KeyboardEvent): void {
        if (this.activeWindow?.keyDown)
            this.activeWindow.keyDown(ev);
    }

    keyUp(ev: KeyboardEvent): void {
        if (this.activeWindow?.keyUp)
            this.activeWindow.keyUp(ev);
    }

    mouseMoved(e: MouseEvent): void {
        if (!this.settings) return;

        if (!this.cursorFrozen) {
            this.cursor.x = clamp(this.cursor.x + e.movementX, 0, this.maxWidth - 3);
            this.cursor.y = clamp(this.cursor.y + e.movementY, 0, this.maxHeight - 1);
        }

        if (this.activeWindow?.mouseMoved)
            this.activeWindow.mouseMoved(e);
    }

    onmouseup(e: MouseEvent): void {
        if (this.activeWindow?.onmouseup)
            this.activeWindow.onmouseup(e);
    }

    onmousedown(e: MouseEvent): void {
        if (this.activeWindow?.onmousedown)
            this.activeWindow.onmousedown(e);
    }

    focusLost(): void {
        if (this.activeWindow?.focusLost)
            this.activeWindow.focusLost();
    }
}
