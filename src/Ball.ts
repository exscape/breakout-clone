import { Vec2 } from './Vec2';

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