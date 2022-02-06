class Vec2 {
    x: number;
    y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    mag() {
        return Math.sqrt(this.x**2 + this.y**2);
    }
}

export type Settings = {
    canvasWidth: number,
    canvasHeight: number,
    canvasMargin: number
};

export class Ball {
    velocity: Vec2

    constructor() {
        this.velocity = new Vec2();
    }
}

export class Paddle {
    width: number;
    x: number;
    y: number;
    settings: Settings;

    constructor(settings: Settings) {
        this.width = 100;
        this.x = (settings.canvasWidth - this.width) / 2;
        this.y = settings.canvasHeight * 0.97;
        this.settings = settings;
    }

    move(deltaX: number, deltaY: number) {
        this.x += deltaX;
        // this.y += deltaY;

        // Keep the paddle in bounds
        if (this.x + this.width > this.settings.canvasWidth - this.settings.canvasMargin)
            this.x = this.settings.canvasWidth - this.settings.canvasMargin - this.width;
        else if (this.x < this.settings.canvasMargin)
            this.x = this.settings.canvasMargin;
    }
}