import _ from 'lodash';
import { Ball } from './Ball';
import { Vec2 } from './Vec2';
import { Settings } from './Settings';
import { clamp, debugAlert } from './Utils';

export class Paddle {
    width: number;
    position: Vec2;
    settings: Settings;
    sticky: number = 0; // Number of "sticky" powerups active
    stuckBall: Ball | null;
    aimAngle: number = 0; // In radians, 0 meaning straight up
    readonly defaultWidth = 125;
    readonly ultrawideWidth = 325;
    ultrawide: boolean = false;
    ultrawideTransitionTime = 0; // How far in the animation we currently are
    stuckBallXRatio: number = 0; // 0-1, ratio of the paddle's width

    constructor(settings: Settings) {
        this.width = this.defaultWidth;
        this.position = new Vec2((settings.canvasWidth - this.width) / 2, settings.canvasHeight * 0.97);
        this.stuckBall = null;
        this.settings = settings;
        this.aimAngle = 0;
    }

    setStuckBall(ball: Ball, recenterBall: boolean = true) {
        this.stuckBall = ball;
        if (ball) {
            const newX = (this.sticky && !recenterBall) ? ball.position.x : this.position.x;
            this.stuckBallXRatio = 0.5 + (newX - this.position.x) / (2 * this.width);
            this.stuckBall.position = new Vec2(newX, this.position.y - this.settings.ballRadius - this.settings.paddleThickness / 2 + 1);
            this.stuckBall.stuck = true;
        }
    }

    launch() {
        if (this.stuckBall == null) {
            debugAlert("BUG: launch() called with stuckBall == null!");
            return;
        }

        let ball = this.stuckBall;
        this.stuckBall = null;
        ball.stuck = false;

        let launchAngle = this.aimAngle;
        ball.velocity.x = Math.sin(launchAngle) * this.settings.ballSpeed;
        ball.velocity.y = -Math.cos(launchAngle) * this.settings.ballSpeed;
    }

    clampPosition() {
        if (this.position.x + this.width / 2 > this.settings.canvasWidth - this.settings.canvasMargin)
            this.position.x = this.settings.canvasWidth - this.settings.canvasMargin - this.width / 2;
        else if (this.position.x - this.width / 2 < this.settings.canvasMargin)
            this.position.x = this.settings.canvasMargin + this.width / 2;

        if (this.stuckBall)
            this.stuckBall.position.x = (this.position.x - this.width) + 2 * this.width * this.stuckBallXRatio;
    }

    move(deltaX: number, deltaY: number) {
        this.position.x += deltaX;
        this.clampPosition();

        this.aimAngle -= deltaY * 0.008;
        this.aimAngle = clamp(this.aimAngle, -Math.PI/3.5, Math.PI/3.5);
    }
}