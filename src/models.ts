export class Vec2 {
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
    canvasMargin: number,
    ballRadius: number,
    paddleThickness: number,
    ballSpeed: number,
    brickWidth: number
    brickHeight: number
};

export class Ball {
    velocity: Vec2;
    position: Vec2;
    color: string;
    stuck: boolean;

    constructor(velocity: Vec2, position: Vec2, color: string) {
        this.velocity = velocity;
        this.position = position;
        this.color = color;
        this.stuck = false;
    }
}

export class Brick {
    position: Vec2; // Upper-left corner
    health: number; // How many hits until destroyed?
    color: string;

    constructor(position: Vec2, color: string, health: number = 1) {
        this.position = position;
        this.health = health;
        this.color = color;
    }
}

export class Paddle {
    width: number;
    position: Vec2;
    settings: Settings;
    stuckBall: Ball | null;

    constructor(settings: Settings) {
        this.width = 100;
        this.position = new Vec2 ((settings.canvasWidth - this.width) / 2, settings.canvasHeight * 0.97);
        this.stuckBall = null;
        this.settings = settings;
    }

    setStuckBall(ball: Ball) {
        this.stuckBall = ball;
        this.stuckBall.position = new Vec2(this.position.x + this.width / 2, this.position.y - this.settings.ballRadius - this.settings.paddleThickness / 2 + 1);
        this.stuckBall.stuck = true;
    }

    launch() {
        if (this.stuckBall == null) {
            alert("BUG: launch() called with stuckBall == null!");
            return;
        }

        let ball = this.stuckBall;
        this.stuckBall = null;
        ball.stuck = false;
        ball.velocity.x = 0;
        ball.velocity.y = -this.settings.ballSpeed;
    }

    move(deltaX: number, deltaY: number) {
        let orig = this.position.x;
        this.position.x += deltaX;

        if (this.position.x + this.width > this.settings.canvasWidth - this.settings.canvasMargin)
            this.position.x = this.settings.canvasWidth - this.settings.canvasMargin - this.width;
        else if (this.position.x < this.settings.canvasMargin)
            this.position.x = this.settings.canvasMargin;

        let actualDeltaX = this.position.x - orig;
        if (this.stuckBall)
            this.stuckBall.position.x += actualDeltaX;
    }
}