import { Rect, UIButton, wrapText } from "../Utils";
import { Vec2 } from "../Vec2";
import { AcceptsInput, InputManager } from "../InputManager";
import { Settings } from "../Settings";

export class ConfirmationDialog implements AcceptsInput {
    text: string;
    positiveButton: UIButton;
    negativeButton: UIButton;
    settings: Settings;
    finished: boolean = false;

    readonly width = 450;
    readonly height = 150;
    readonly buttonSpacing = 10;
    readonly buttonWidth = (this.width - 3 * this.buttonSpacing) / 2; // Spacing left, between buttons, right
    readonly buttonHeight = 20;
    pos: Vec2;

    constructor(text: string, positiveText: string, negativeText: string, settings: Settings, positiveCallback: () => void, negativeCallback: () => void) {
        this.text = text;
        this.settings = settings;
        this.pos = new Vec2(Math.floor((this.settings.canvasWidth - this.width) / 2), Math.floor((this.settings.canvasHeight - this.height) / 2));

        const positiveRect = new Rect(this.pos.x + this.buttonSpacing, this.pos.y + this.height - this.buttonHeight - this.buttonSpacing, this.buttonWidth, this.buttonHeight);
        const negativeRect = new Rect(this.pos.x + this.width - this.buttonSpacing - this.buttonWidth, this.pos.y + this.height - this.buttonHeight - this.buttonSpacing, this.buttonWidth, this.buttonHeight);
        this.positiveButton = new UIButton(positiveRect, null, positiveText, true, positiveCallback);
        this.negativeButton = new UIButton(negativeRect, null, negativeText, true, negativeCallback);
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
        let lines = wrapText(ctx, this.text, this.width - 2 * this.buttonSpacing);

        ctx.fillStyle = "black";
        let y = this.settings.canvasHeight / 2 - this.height / 4;
        for (let line of lines) {
            ctx.fillText(line, this.settings.canvasWidth / 2, y);
            y += parseInt(ctx.font) + 4;
        }
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
    }

    onmousedown(e: MouseEvent) {
        const cursor = InputManager.getInstance().cursor;
        if (this.positiveButton.rect.isInsideRect(cursor))
            this.positiveButton.clickCallback(true);
        else if (this.negativeButton.rect.isInsideRect(cursor))
            this.negativeButton.clickCallback(true);
    }
}
