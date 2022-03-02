import { Settings } from "./Settings";

export class LoadingScreen {
    message: string;
    settings: Settings;
    finished: boolean = false;

    constructor(message: string, settings: Settings) {
        this.message = message;
        this.settings = settings;
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.finished)
            return;

        ctx.beginPath();
        ctx.font = "22px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const {width: textWidth} = ctx.measureText(this.message);

        ctx.fillStyle = "#e5e5e5";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;

        const width = textWidth + 50;
        const loadingHeight = 70;
        ctx.fillRect((this.settings.canvasWidth - width) / 2, (this.settings.canvasHeight - loadingHeight) / 2, width, loadingHeight);
        ctx.strokeRect((this.settings.canvasWidth - width) / 2, (this.settings.canvasHeight - loadingHeight) / 2, width, loadingHeight);

        ctx.fillStyle = "black";
        ctx.fillText(this.message, this.settings.canvasWidth / 2, this.settings.canvasHeight / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
    }
}
