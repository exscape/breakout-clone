import { Ball } from './Ball';
import { Brick } from './Brick';
import { Settings } from './Settings';
import { Vec2 } from './Vec2';

export enum CollisionFrom {
    None,
    Left,
    Right,
    Top,
    Bottom
}

function isAboveLine(corner: Vec2, oppositeCorner: Vec2, ballCenter: Vec2) {
    return ((oppositeCorner.x - corner.x) * (ballCenter.y - corner.y) - (oppositeCorner.y - corner.y) * (ballCenter.x - corner.x)) > 0;
}

export class CollisionHandler {
    settings: Settings;

    constructor(settings: Settings) {
        this.settings = settings;
    }

    handleWallCollisions(ball: Ball) {
        const r = this.settings.ballRadius;

        if (ball.position.x <= r) {
            ball.position.x = r;
            ball.velocity.x = -ball.velocity.x;
        }
        else if (ball.position.x + r >= this.settings.canvasWidth) {
            ball.position.x = this.settings.canvasWidth - r;
            ball.velocity.x = -ball.velocity.x;
        }

        // Handle roof collisions
        if (ball.position.y <= r) {
            ball.position.y = r;
            ball.velocity.y = -ball.velocity.y;
        }
    }

    brickCollision(ball: Ball, brick: Brick, dt: number): boolean {
        // Calculates whether the ball and brick are colliding.
        let {x, y} = ball.position;

        if (ball.position.x <= brick.upperLeft.x) {
            x = brick.upperLeft.x;
        }
        else if (ball.position.x > brick.upperLeft.x + this.settings.brickWidth) {
            x = brick.upperLeft.x + this.settings.brickWidth;
        }

        if (ball.position.y <= brick.upperLeft.y) {
            y = brick.upperLeft.y;
        }
        else if (ball.position.y > brick.upperLeft.y + this.settings.brickHeight) {
            y = brick.upperLeft.y + this.settings.brickHeight;
        }

        // Note: If the ball (center) is inside the brick, i.e. the above if statements aren't run,
        // the default x/y values will make this expression zero, and so still register a collision.
        let dist = Math.sqrt((ball.position.x - x)**2 + (ball.position.y - y)**2);

        // If true, there was no collision.
        if (dist > this.settings.ballRadius)
            return false;

        // There was a collision. Figure out the direction and bounce the ball.
        let direction = this.collisionDirection(ball, brick);
        if (direction == CollisionFrom.Top || direction == CollisionFrom.Bottom) {
            ball.velocity.y = -ball.velocity.y;
            // TODO: This (and the one below) restores the ball to the pre-collision position (on this axis).
            // TODO: It would be better to restore it so that it's one pixel away from colliding, instead.
            ball.position.y += ball.velocity.y * dt;
        }
        else {
            ball.velocity.x = -ball.velocity.x;
            ball.position.x += ball.velocity.x * dt;
        }

        return true;
    }

    collisionDirection(ball: Ball, brick: Brick): CollisionFrom {
        // Based on:
        // https://stackoverflow.com/questions/19198359/how-to-determine-which-side-of-a-rectangle-collides-with-a-circle/19202228#19202228

        let isAboveAC = isAboveLine(brick.bottomRight, brick.upperLeft, ball.position);
        let isAboveDB = isAboveLine(brick.upperRight, brick.bottomLeft, ball.position);

        if (isAboveAC)
            return isAboveDB ? CollisionFrom.Top : CollisionFrom.Right;
        else
            return isAboveDB ? CollisionFrom.Left : CollisionFrom.Bottom;
    }
}