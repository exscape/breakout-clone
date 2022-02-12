import _ from 'lodash';
import { Ball } from './Ball';
import { Vec2 } from './Vec2';
import { Settings } from './Settings';

export class Paddle {
    width: number;
    position: Vec2;
    settings: Settings;
    sticky: Boolean = true; // Is the "sticky" powerup active?
    stuckBall: Ball | null;

    constructor(settings: Settings) {
        this.width = 100;
        this.position = new Vec2((settings.canvasWidth - this.width) / 2, settings.canvasHeight * 0.97);
        this.stuckBall = null;
        this.settings = settings;
    }

    setStuckBall(ball: Ball) {
        this.stuckBall = ball;
        if (ball) {
            this.stuckBall.position = new Vec2(this.position.x + this.width / 2, this.position.y - this.settings.ballRadius - this.settings.paddleThickness / 2 + 1);
            this.stuckBall.stuck = true;
        }
    }

    setSticky(sticky: boolean) {
        // Used by the collision code
        this.sticky = sticky;
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
            let angle = _.random(-Math.PI / 4, Math.PI / 4);
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