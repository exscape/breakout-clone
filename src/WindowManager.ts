import { Settings } from "./Settings";
import { ConfirmationDialog } from "./UI/ConfirmationDialog";
import { LoadingScreen } from "./UI/LoadingScreen";
import { clamp, debugAlert } from "./Utils";
import { Vec2 } from "./Vec2";

export interface Window {
    keyDown?(ev: KeyboardEvent): void;
    keyUp?(ev: KeyboardEvent): void;
    mouseMoved?(e: MouseEvent): void;
    onmouseup?(e: MouseEvent): void;
    onmousedown?(e: MouseEvent): void;
    focusLost?(): void;

    acceptsInput: boolean;
    ignoresInput: boolean;
    showOldestFirst?: boolean;
}

// This implements Window because it's an easy way to get access to keyDown, keyUp etc
// in main.ts; it's pretty much a hack, but I don't see much of a downside.
export class WindowManager implements Window {
    private static instance: WindowManager;
    private constructor() {
        this.cursor = new Vec2();
    }

    knownWindows: Window[] = [];
    activeWindow: Window | null = null;
    settings: Settings | null = null;
    cursor: Vec2;
    cursorFrozen: boolean = true;
    acceptsInput = false;
    ignoresInput = false;

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

    addWindow(window: Window, setAsActive: boolean = false) {
        if (this.knownWindows.includes(window))
            debugAlert("BUG: addWindow() on previously known window");

        this.knownWindows.push(window);

        if (setAsActive)
            this.setActiveWindow(window);
    }

    removeWindow(toRemove: Window | null) {
        const _remove = (toRemove: Window) => { this.knownWindows = this.knownWindows.filter(w => w !== toRemove); }
        // Most of the time, the window being removed is active, and we should
        // pop back to the previous window in the stack.
        if (toRemove && toRemove === this.activeWindow) {
            // If there are any NotficationDialogs or similar, show them in order, oldest first.
            const oldestFirst = this.getWindowsMatching((window: Window) => window.showOldestFirst === true && window !== toRemove);
            for (let dialog of oldestFirst) {
                if (dialog !== toRemove) {
                    let test;
                    if ((dialog as any)['constructor']['name'] === "NotificationDialog")
                        test = (dialog as any).text;
                    this.setActiveWindow(dialog);
                    _remove(toRemove);

                    return;
                }
            }

            // No such dialogs, continue as usual.
            for (let i = this.knownWindows.length - 1; i >= 0; i--) {
                let prevActive = this.knownWindows[i];
                if (prevActive && prevActive !== toRemove) {
                    this.setActiveWindow(prevActive);
                    _remove(toRemove);

                    return;
                }
            }
        }
        else if (toRemove) {
            _remove(toRemove);
        }
    }

    getWindowsMatching(predicate: (window: Window) => boolean) {
        return this.knownWindows.filter(predicate);
    }

    setActiveWindow(window: Window) {
        // Send a focusLost to the currently active window
        if (this.activeWindow && this.activeWindow !== window && this.activeWindow.focusLost)
            this.activeWindow.focusLost();

        this.activeWindow = window;

        // Move this to the top of the window stack, in addition to setting activeWindow
        if (window.showOldestFirst !== true) {
            this.knownWindows = this.knownWindows.filter(w => w !== window);
            this.knownWindows.push(window);
        }
    }

    getLoadingScreen(): LoadingScreen | null {
        for (let window of this.knownWindows) {
            if (window instanceof LoadingScreen)
                return window;
        }

        return null;
    }

    removeLoadingScreen() {
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

    removeConfirmationDialog() {
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
