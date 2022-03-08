import { Settings } from "../Settings";
import { Rect, splitText, UIButton, wrapText } from "../Utils";
import { Vec2 } from "../Vec2";
import { Window, WindowManager } from "../WindowManager";

export class GenericDialog implements Window {
    positiveButton: UIButton | null = null;
    negativeButton: UIButton | null = null;
    settings: Settings;
    finished: boolean = false;

    acceptsInput: boolean;
    ignoresInput: boolean;

    font = "18px Arial";
    width: number;
    height: number;
    readonly buttonSpacing = 10;
    buttonWidth: number;
    readonly buttonHeight = 20;
    pos: Vec2;

    text: string;
    lines: string[] = [];

    constructor(text: string, positiveText: string | null, negativeText: string | null, settings: Settings, acceptsInput: boolean = true, ignoresInput: boolean = false,
                positiveCallback: (() => void) | null, negativeCallback: (() => void) | null) {
        this.settings = settings;

        let canvas = document.createElement('canvas');
        let context = canvas.getContext('2d')!;
        context.font = this.font;
        this.lines = wrapText(context, text, 400);

        // We have the lines, wrapped to fit at most 400 px.
        // That may be way excessive though, so check if we should make the window smaller.
        const longestLine = Math.max(...this.lines.map(line => context.measureText(line).width));
        this.width = Math.min(longestLine + 50, 450);

        // TODO: Too small when dialog text is short; size after button text length! Though the dialog size may also need adjusting in that case.
        this.buttonWidth = (this.width - 3 * this.buttonSpacing) / 2; // Spacing left, between buttons, right

        // Figure out a reasonable height
        if (positiveText) {
            // We have at least one button
            this.height = Math.max(60 + this.lines.length * (parseInt(this.font) + 4) + this.buttonHeight, 100);
        }
        else {
            // No buttons
            this.height = Math.max(30 + this.lines.length * (parseInt(this.font) + 4) + this.buttonHeight, 50);
        }

        this.pos = new Vec2(Math.floor((this.settings.canvasWidth - this.width) / 2), Math.floor((this.settings.canvasHeight - this.height) / 2));

        this.text = text;

        this.acceptsInput = acceptsInput;
        this.ignoresInput = ignoresInput;

        const buttonCount = positiveText ? (negativeText ? 2 : 1) : 0;

        if (buttonCount === 2) {
            const positiveRect = new Rect(this.pos.x + this.buttonSpacing, this.pos.y + this.height - this.buttonHeight - this.buttonSpacing, this.buttonWidth, this.buttonHeight);
            this.positiveButton = new UIButton(positiveRect, null, positiveText!, null, true, false, positiveCallback!);
            const negativeRect = new Rect(this.pos.x + this.width - this.buttonSpacing - this.buttonWidth, this.pos.y + this.height - this.buttonHeight - this.buttonSpacing, this.buttonWidth, this.buttonHeight);
            this.negativeButton = new UIButton(negativeRect, null, negativeText!, null, true, false, negativeCallback ?? (() => {}));
        }
        else if (buttonCount === 1) {
            const positiveRect = new Rect(this.pos.x + (this.width - this.buttonWidth) / 2, this.pos.y + this.height - this.buttonHeight - this.buttonSpacing, this.buttonWidth, this.buttonHeight);
            this.positiveButton = new UIButton(positiveRect, null, positiveText!, null, true, false, positiveCallback!);
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.finished)
            return;

        ctx.beginPath();
        ctx.font = this.font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillStyle = "#f5f5f5";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;

        if (this.lines.length === 0)
            this.lines = splitText(this.text);

        ctx.fillRect(this.pos.x, this.pos.y, this.width, this.height);
        ctx.strokeRect(this.pos.x, this.pos.y, this.width, this.height);

        ctx.fillStyle = "black";

        // Offset text if this dialog has buttons, otherwise center it
        let y = (this.positiveButton) ? this.settings.canvasHeight / 2 - this.height / 4 : this.settings.canvasHeight / 2;

        for (let line of this.lines) {
            ctx.fillText(line, this.settings.canvasWidth / 2, y);
            y += parseInt(ctx.font) + 4;
        }
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
    }

    onmousedown(e: MouseEvent) {
        const cursor = WindowManager.getInstance().cursor;
        if (this.positiveButton && this.positiveButton.rect.isInsideRect(cursor))
            this.positiveButtonClicked();
        else if (this.negativeButton && this.negativeButton.rect.isInsideRect(cursor))
            this.negativeButtonClicked();
    }

    keyDown(ev: KeyboardEvent) {
        if (this.positiveButton && !this.negativeButton && ev.key === "Enter")
            this.positiveButtonClicked();
    }

    positiveButtonClicked() {
        if (this.positiveButton?.clickCallback)
            this.positiveButton.clickCallback(this.positiveButton);
    }

    negativeButtonClicked() {
        if (this.negativeButton?.clickCallback)
            this.negativeButton.clickCallback(this.negativeButton);
    }
}
