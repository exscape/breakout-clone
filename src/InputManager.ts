
export interface AcceptsInput {
    keyDown?(ev: KeyboardEvent): void;
    keyUp?(ev: KeyboardEvent): void;
    mouseMoved?(e: MouseEvent): void;
    onmouseup?(e: MouseEvent): void;
    onmousedown?(e: MouseEvent): void;
    focusLost?(): void;
}

export class InputManager implements AcceptsInput {
    private static instance: InputManager;
    private constructor() {}

    activeWindow: AcceptsInput | null = null;

    public static getInstance() {
        if (!InputManager.instance) {
            InputManager.instance = new InputManager();
        }

        return InputManager.instance;
    }

    setActiveWindow(window: AcceptsInput) {
        this.activeWindow = window;
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
