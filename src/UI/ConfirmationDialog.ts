import { Settings } from "../Settings";
import { GenericDialog } from "./GenericDialog";

export class ConfirmationDialog extends GenericDialog {
    constructor(text: string, positiveText: string, negativeText: string, settings: Settings, positiveCallback: () => void, negativeCallback: () => void) {
        super(text, positiveText, negativeText, settings, positiveCallback, negativeCallback);
    }
}
