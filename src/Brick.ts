import { Vec2 } from './Vec2';
import { Settings } from './Settings';

export class Brick {
    health: number; // How many hits until destroyed?
    name: string;
    score: number;
    indestructible: boolean;

    upperLeft: Vec2;
    upperRight: Vec2;
    bottomLeft: Vec2;
    bottomRight: Vec2;

    constructor(position: Vec2, name: string, settings: Settings, score: number, health: number = 1, indestructible: boolean = false) {
        this.health = health;
        this.name = name;
        this.score = score;
        this.indestructible = indestructible;

        // The other corners are used by the collision checking code
        this.upperLeft = position;
        this.upperRight = new Vec2(position.x + settings.brickWidth, position.y);
        this.bottomLeft = new Vec2(position.x, position.y + settings.brickHeight);
        this.bottomRight = new Vec2(position.x + settings.brickWidth, position.y + settings.brickHeight);
    }
}