import { WindowManager } from "../WindowManager";
import { Settings } from "../Settings";
import { GenericDialog } from "./GenericDialog";

export class ConfirmationDialog extends GenericDialog {
    constructor(text: string, positiveText: string, negativeText: string, settings: Settings, positiveCallback: () => void, negativeCallback: (() => void) | null) {
        super(text, positiveText, negativeText, settings, true, false, positiveCallback, negativeCallback);
    }

    positiveButtonClicked() {
        WindowManager.getInstance().removeWindow(this);

        super.positiveButtonClicked();
    }

    negativeButtonClicked() {
        WindowManager.getInstance().removeWindow(this);

        super.negativeButtonClicked();
    }
}
