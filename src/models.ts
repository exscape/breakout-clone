import _ from 'lodash';

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
    prevPosition: Vec2;
    color: string;
    stuck: boolean;

    constructor(velocity: Vec2, position: Vec2, color: string) {
        this.velocity = velocity;
        this.position = position;
        this.prevPosition = position;
        this.color = color;
        this.stuck = false;
    }
}

export class Brick {
    health: number; // How many hits until destroyed?
    color: string;

    upperLeft: Vec2;
    upperRight: Vec2;
    bottomLeft: Vec2;
    bottomRight: Vec2;

    constructor(position: Vec2, color: string, settings: Settings, health: number = 1) {
        this.health = health;
        this.color = color;

        // The other corners are used by the collision checking code
        this.upperLeft = position;
        this.upperRight = new Vec2(position.x + settings.brickWidth, position.y);
        this.bottomLeft = new Vec2(position.x, position.y + settings.brickHeight);
        this.bottomRight = new Vec2(position.x + settings.brickWidth, position.y + settings.brickHeight);
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

        const launchStraightUp = true;

        let ball = this.stuckBall;
        this.stuckBall = null;
        ball.stuck = false;
        if (launchStraightUp) {
            ball.velocity.x = 0;
            ball.velocity.y = -this.settings.ballSpeed;
        }
        else {
            let angle = _.random(-Math.PI/4, Math.PI/4);
            ball.velocity.x = Math.sin(angle) * this.settings.ballSpeed;
            ball.velocity.y = -Math.cos(angle) * this.settings.ballSpeed;
        }
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