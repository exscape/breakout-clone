import { Vec2 } from './Vec2';
import { Settings } from './Settings';
import { drawCoordsFromBrickCoords } from './Utils';

export type BrickOrEmpty = Brick | undefined;

export class Brick {
    health: number; // How many hits until destroyed?
    name: string;
    score: number;
    indestructible: boolean;
    settings: Settings;

    // The other corners are used by the collision checking code
    upperLeft: Vec2;
    upperRight: Vec2;
    bottomLeft: Vec2;
    bottomRight: Vec2;

    // Only used in the editor
    selected: boolean = false;

    constructor(position: Vec2, name: string, settings: Settings, score: number, health: number = 1, indestructible: boolean = false, selected: boolean = false) {
        this.health = health;
        this.name = name;
        this.score = score;
        this.indestructible = indestructible;
        this.settings = settings;
        this.selected = selected;

        // Sigh; not sure how to prevent this. The compiler doesn't realize these are ALWAYS set if we call this.setUpperLeft() instead
        // of duplicating it here...
        this.upperLeft = new Vec2(position);
        this.upperRight = new Vec2(position.x + this.settings.brickWidth, position.y);
        this.bottomLeft = new Vec2(position.x, position.y + this.settings.brickHeight);
        this.bottomRight = new Vec2(position.x + this.settings.brickWidth, position.y + this.settings.brickHeight);
    }

    setUpperLeft(upperLeft: Vec2) {
        this.upperLeft = new Vec2(upperLeft);
        this.upperRight = new Vec2(upperLeft.x + this.settings.brickWidth, upperLeft.y);
        this.bottomLeft = new Vec2(upperLeft.x, upperLeft.y + this.settings.brickHeight);
        this.bottomRight = new Vec2(upperLeft.x + this.settings.brickWidth, upperLeft.y + this.settings.brickHeight);
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
