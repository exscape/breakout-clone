import _ from 'lodash';
import { Settings } from './Settings';
import { Vec2 } from './Vec2';

export class Ball {
    velocity: Vec2;
    position: Vec2;
    stuck: boolean;
    collided: boolean; // Did this ball collide *this frame*?
    fireball: boolean;
    rotation: number;

    constructor(velocity: Vec2, position: Vec2) {
        this.velocity = velocity;
        this.position = position;
        this.stuck = false;
        this.collided = false;
        this.fireball = false;
        this.rotation = 0;
    }

    correctVelocity(settings: Settings) {
        // Ensures the ball isn't moving entirely in one dimension, which runs the risk of the ball getting
        // stuck, permanently or at least for a long time, between combinations of  indestructible blocks and walls.
        // Standard magnitude is 0.75 at the moment, so typically mag() returns either 0.75 or 0.
        if (this.velocity.mag() > 0.2) {
            if (Math.abs(this.velocity.x) < 0.05) {
                this.velocity.x = _.random(0.05, 0.11) * ((_.random(0, 1, false) == 0) ? 1 : -1);
                this.velocity.setMagnitude(settings.ballSpeed);
            }
            if (Math.abs(this.velocity.y) < 0.05) {
                this.velocity.y = _.random(0.05, 0.11) * ((_.random(0, 1, false) == 0) ? 1 : -1);
                this.velocity.setMagnitude(settings.ballSpeed);
            }
        }
    }
}
