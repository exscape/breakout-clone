import { Settings } from "../Settings";
import { Rect, splitText, UIButton } from "../Utils";
import { Vec2 } from "../Vec2";
import { Window, WindowManager } from "../WindowManager";

export class GenericDialog implements Window {
    text: string;
    positiveButton: UIButton | null = null;
    negativeButton: UIButton | null = null;
    settings: Settings;
    finished: boolean = false;

    acceptsInput: boolean;
    ignoresInput: boolean;

    readonly width = 450;
    readonly height = 150;
    readonly buttonSpacing = 10;
    readonly buttonWidth = (this.width - 3 * this.buttonSpacing) / 2; // Spacing left, between buttons, right
    readonly buttonHeight = 20;
    pos: Vec2;

    constructor(text: string, positiveText: string | null, negativeText: string | null, settings: Settings, acceptsInput: boolean = true, ignoresInput: boolean = false,
                positiveCallback: (() => void) | null, negativeCallback: (() => void) | null) {
        this.text = text;
        this.settings = settings;
        this.pos = new Vec2(Math.floor((this.settings.canvasWidth - this.width) / 2), Math.floor((this.settings.canvasHeight - this.height) / 2));

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
        ctx.font = "18px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillStyle = "#f5f5f5";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;

        ctx.fillRect(this.pos.x, this.pos.y, this.width, this.height);
        ctx.strokeRect(this.pos.x, this.pos.y, this.width, this.height);
        // let lines = wrapText(ctx, this.text, this.width - 2 * this.buttonSpacing);
        let lines = splitText(this.text);

        ctx.fillStyle = "black";

        // Offset text if this dialog has buttons, otherwise center it
        let y = (this.positiveButton) ? this.settings.canvasHeight / 2 - this.height / 4 : this.height / 2;

        for (let line of lines) {
            ctx.fillText(line, this.settings.canvasWidth / 2, y);
            y += parseInt(ctx.font) + 4;
        }
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
    }

    onmousedown(e: MouseEvent) {
        const cursor = WindowManager.getInstance().cursor;
        if (this.positiveButton && this.positiveButton.rect.isInsideRect(cursor))
            this.positiveButton.clickCallback(this.positiveButton);
        else if (this.negativeButton && this.negativeButton.rect.isInsideRect(cursor))
            this.negativeButton.clickCallback(this.negativeButton);
    }

    keyDown(ev: KeyboardEvent) {
        if (this.positiveButton && !this.negativeButton && ev.key === "Enter")
            this.positiveButton.clickCallback(this.positiveButton);
    }
}
