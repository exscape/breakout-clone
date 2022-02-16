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

    constructor(settings: Settings) {
        this.width = 125;
        this.position = new Vec2((settings.canvasWidth - this.width) / 2, settings.canvasHeight * 0.97);
        this.stuckBall = null;
        this.settings = settings;
        this.aimAngle = 0;
    }

    setStuckBall(ball: Ball) {
        this.stuckBall = ball;
        if (ball) {
            this.stuckBall.position = new Vec2(this.position.x, this.position.y - this.settings.ballRadius - this.settings.paddleThickness / 2 + 1);
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

    move(deltaX: number, deltaY: number) {
        let orig = this.position.x;
        this.position.x += deltaX;

        if (this.position.x + this.width / 2 > this.settings.canvasWidth - this.settings.canvasMargin)
            this.position.x = this.settings.canvasWidth - this.settings.canvasMargin - this.width;
        else if (this.position.x < this.settings.canvasMargin)
            this.position.x = this.settings.canvasMargin;

        let actualDeltaX = this.position.x - orig;
        if (this.stuckBall)
            this.stuckBall.position.x += actualDeltaX;

        this.aimAngle -= deltaY * 0.008;
        this.aimAngle = clamp(this.aimAngle, -Math.PI/3.5, Math.PI/3.5);
    }
}