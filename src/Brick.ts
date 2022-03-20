import { Settings } from './Settings';
import { drawCoordsFromBrickCoords } from './Utils';
import { Vec2 } from './Vec2';

export type BrickOrEmpty = Brick | undefined;

export class Brick {
    health: number; // How many hits until destroyed?
    name: string;
    score: number;
    indestructible: boolean;
    settings: Settings;

    // The other corners/positions are used by the collision checking code
    upperLeft!: Vec2;
    upperRight!: Vec2;
    bottomLeft!: Vec2;
    bottomRight!: Vec2;
    center!: Vec2;

    // Only used in the editor
    selected: boolean = false;

    constructor(position: Vec2, name: string, settings: Settings, score: number, health: number = 1, indestructible: boolean = false, selected: boolean = false) {
        this.health = health;
        this.name = name;
        this.score = score;
        this.indestructible = indestructible;
        this.settings = settings;
        this.selected = selected;

        this.setUpperLeft(position);
    }

    setUpperLeft(upperLeft: Vec2) {
        this.upperLeft = new Vec2(upperLeft);
        this.upperRight = new Vec2(upperLeft.x + this.settings.brickWidth, upperLeft.y);
        this.bottomLeft = new Vec2(upperLeft.x, upperLeft.y + this.settings.brickHeight);
        this.bottomRight = new Vec2(upperLeft.x + this.settings.brickWidth, upperLeft.y + this.settings.brickHeight);
        this.center = new Vec2(upperLeft.x + this.settings.brickWidth / 2, upperLeft.y + this.settings.brickHeight / 2);
    }

    copy(): Brick {
        return new Brick(new Vec2(this.upperLeft), this.name, this.settings, this.score, this.health, this.indestructible, this.selected);
    }

    updateDrawPosition(x: number, y: number) {
        // Calculate position based on its location on the level
        const newX = drawCoordsFromBrickCoords("x", x, this.settings);
        const newY = drawCoordsFromBrickCoords("y", y, this.settings);
        this.setUpperLeft(new Vec2(newX, newY));
    }
}
