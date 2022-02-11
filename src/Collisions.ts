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

    brickCollision(ball: Ball, brick: Brick): CollisionFrom {
        // Calculates whether the ball and brick are colliding, and if so, from which direction the ball is coming.
        // TODO: Walk through this very carefully to ensure the ball can't slip through, e.g. on a corner pixel
        // TODO: Return collision direction
        let {x, y} = ball.position;

        // TODO: Use ball.velocity to figure out collision direction

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

        if (dist > this.settings.ballRadius)
            return CollisionFrom.None;
        else
            return this.collisionDirection(ball, brick);
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