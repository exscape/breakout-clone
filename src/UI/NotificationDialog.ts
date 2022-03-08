import { WindowManager } from "../WindowManager";
import { Settings } from "../Settings";
import { GenericDialog } from "./GenericDialog";

export class NotificationDialog extends GenericDialog {
    timeout: number | null;
    timeoutCallback: (() => void) | null;
    timerStarted: boolean = false;

    constructor(text: string, settings: Settings, positiveText: string | null, timeout: number | null = null,
                positiveCallback: (() => void) | null = null, timeoutCallback: (() => void) | null = null) {
        super(text, positiveText, null, settings, (positiveText !== null), (positiveText === null), positiveCallback, null);

        this.timeout = timeout;
        this.timeoutCallback = timeoutCallback;
    }

    draw(ctx: CanvasRenderingContext2D) {
        super.draw(ctx)

        if (!this.timerStarted && this.timeout) {
            setTimeout(() => {
                WindowManager.getInstance().removeWindow(this);

                if (this.timeoutCallback)
                    this.timeoutCallback();
            }, this.timeout);
            this.timerStarted = true;
        }
    }

    positiveButtonClicked() {
        WindowManager.getInstance().removeWindow(this);

        super.positiveButtonClicked();
    }
}
