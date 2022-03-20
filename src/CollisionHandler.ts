import { Ball } from './Ball';
import { Brick, BrickOrEmpty } from './Brick';
import { Settings } from './Settings';
import { brickCoordsFromDrawCoords, clamp, debugAlert, generatePairs } from './Utils';
import { Vec2 } from './Vec2';

export enum CollisionFrom {
    None,
    Left,
    Right,
    Top,
    Bottom
}

export type Intersection = {
    x: number,
    y: number,
    brick: Brick
};

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

    differenceVector(point: Vec2, brick: Brick): Vec2 {
        let NearestX = Math.max(brick.upperLeft.x, Math.min(point.x, brick.bottomRight.x));
        let NearestY = Math.max(brick.upperLeft.y, Math.min(point.y, brick.bottomRight.y));
        return new Vec2(point.x - NearestX, point.y - NearestY);
    }

    findIntersectingBricks(bricks: BrickOrEmpty[][], ball: Ball): Intersection[] {
        // Calculate which bricks intersect with the ball, and return a list.
        const minX = clamp(brickCoordsFromDrawCoords("x", ball.position.x, this.settings) - 1, 0, this.settings.levelWidth - 1);
        const maxX = clamp(minX + 2, 0, this.settings.levelWidth - 1);
        const minY = clamp(brickCoordsFromDrawCoords("y", ball.position.y, this.settings) - 1, 0, this.settings.levelHeight - 1);
        const maxY = clamp(minY + 2, 0, this.settings.levelHeight - 1);

        let intersections: Intersection[] = [];
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                let brick = bricks[y][x];
                if (brick === undefined) continue;
                let distVector = this.differenceVector(ball.position, brick);
                if (distVector.mag() <= this.settings.ballRadius)
                    intersections.push({ x, y, brick });
            }
        }

        return intersections;
    }

    brickCollision(ball: Ball, brick: Brick, dt: number): boolean {
        if (ball.fireball && !brick.indestructible) // Don't bother calculating anything further
            return true;

        let direction = this.collisionDirection(ball, brick);

        if (direction == CollisionFrom.Top || direction == CollisionFrom.Bottom) {
            ball.velocity.y = -ball.velocity.y;

            // *Subtract* this from the ball's position and it will no longer overlap
            let verticalOverlap = (direction == CollisionFrom.Top) ? ball.position.y + this.settings.ballRadius - brick.upperLeft.y + 2   // e.g. 460 - 455 = 5
                                                                   : ball.position.y - this.settings.ballRadius - brick.bottomLeft.y - 2; // e.g. 500 - 505 = -5
            ball.position.y -= verticalOverlap;

            // TODO: These (and almost certainly the ones for left/right) can trigger occasionally, but very rarely.
            // TODO: I'm not sure when, but possibly when multiple balls are near each other and colliding, pushing eachother into bricks?
            // TODO: Not sure if it's an actual issue or whether it can be ignored yet. I suppose it does mean there's a risk balls get stuck in indestructible bricks?
            if (direction == CollisionFrom.Top && Math.sign(ball.velocity.y) != -1)
                debugAlert("MATH ERROR: moving wrong direction after collision (top hit)");
            else if (direction == CollisionFrom.Bottom && Math.sign(ball.velocity.y) != 1)
                debugAlert("MATH ERROR: moving wrong direction after collision (bottom hit)");
        }
        else {
            ball.velocity.x = -ball.velocity.x;

            // *Subtract* this from the ball's position and it will no longer overlap
            let horizontalOverlap = (direction == CollisionFrom.Left) ? ball.position.x + this.settings.ballRadius - brick.upperLeft.x + 2   // e.g. 460 - 455 = 5
                                                                      : ball.position.x - this.settings.ballRadius - brick.upperRight.x - 2; // e.g. 500 - 505 = -5
            ball.position.x -= horizontalOverlap;

            if (direction == CollisionFrom.Left && Math.sign(ball.velocity.x) != -1)
                debugAlert("MATH ERROR: moving wrong direction after collision (left hit)");
            else if (direction == CollisionFrom.Right && Math.sign(ball.velocity.x) != 1)
                debugAlert("MATH ERROR: moving wrong direction after collision (right hit)");
        }

        return true;
    }

    collisionDirection(ball: Ball, brick: Brick): CollisionFrom {
        // Based on:
        // https://stackoverflow.com/questions/19198359/how-to-determine-which-side-of-a-rectangle-collides-with-a-circle/19202228#19202228

        let isAboveAC = isAboveLine(brick.bottomRight, brick.upperLeft, ball.position);
        let isAboveDB = isAboveLine(brick.upperRight, brick.bottomLeft, ball.position);

        let direction;
        if (isAboveAC)
            direction = isAboveDB ? CollisionFrom.Top : CollisionFrom.Right;
        else
            direction = isAboveDB ? CollisionFrom.Left : CollisionFrom.Bottom;

        // The above code yields incorrect results in some cases, such as when hitting the upper-left corner from the left side, when the ball center is above a certain point.
        // It will be detected as a collision from above, even through the ball may be moving upwards; it is therefore reflected downwards, *towards the block*.
        // The code below fixes this issue by taking the direction into account properly.
        if ((direction == CollisionFrom.Top && Math.sign(ball.velocity.y) != 1) || (direction == CollisionFrom.Bottom && Math.sign(ball.velocity.y) != -1)) {
            if (ball.position.x < brick.upperLeft.x + this.settings.brickWidth / 2)
                direction = CollisionFrom.Left;
            else
                direction = CollisionFrom.Right;
        }
        else if ((direction == CollisionFrom.Left && Math.sign(ball.velocity.x) != 1) || direction == CollisionFrom.Right && Math.sign(ball.velocity.x) != -1) {
            if (ball.position.y < brick.upperLeft.y + this.settings.brickHeight / 2) {
                direction = CollisionFrom.Top;
            }
            else {
                direction = CollisionFrom.Bottom;
            }
        }

        return direction;
    }

    handleBallBallCollisions(balls: Ball[]) {
        // Build a list of all unique pairs (e.g. A+B, A+C, B+C -- but not also B+A, C+A, C+B), and check each for collisions.
        let ballPairs = generatePairs(balls);
        for (let pair of ballPairs) {
            // Based on: https://imada.sdu.dk/~rolf/Edu/DM815/E10/2dcollisions.pdf
            // This only runs if there are at least two balls present.
            let [firstBall, secondBall] = pair;

            let distance = Math.sqrt((firstBall.position.x - secondBall.position.x)**2 + (firstBall.position.y - secondBall.position.y)**2);

            // No collision
            if (distance >= 2 * this.settings.ballRadius)
                continue;

            // If one of the balls is stuck, ensure it's firstBall, to make the rest of the code easier.
            // Collisions with a stuck ball are treated like collisions with a wall, i.e. the velocity is reflected about the tangent axis
            // (i.e *along* the axis connecting the ball centers) while the stuck ball is not affected at all.
            if (secondBall.stuck)
                [firstBall, secondBall] = [secondBall, firstBall];
            if (secondBall.stuck)
                debugAlert("BUG: firstBall stuck despite swap -- multiple stuck balls!");

            // Step 1
            let normal = new Vec2(firstBall.position).subtract(secondBall.position);

            // Rare, but happens in testing when you launch a TON of balls straight up and let them bounce.
            // Causes major bugs if not handled. Ignoring the collision is not ideal, but this is SO unlikely to happen
            // in a normal gaming situation, *AND* if it happens it's not a big deal at all to skip the collision.
            // Note that testing against exactly zero is intended; values near zero are fine, as we can normalize those vectors.
            if (normal.mag() == 0)
                continue;

            normal.normalize();
            let tangent = new Vec2(-normal.y, normal.x);
            if (Math.abs(1-tangent.mag()) > 0.01)
                debugAlert("MATH ERROR: tangent vector not a unit vector");

            // Step 3 and 4 (step 2 is not necessary)
            let v1 = { normal: normal.dot(firstBall.velocity), tangent: tangent.dot(firstBall.velocity ) };
            let v2 = { normal: normal.dot(secondBall.velocity), tangent: tangent.dot(secondBall.velocity ) };

            // Step 5 (for balls with equal mass)
            // If one ball is stuck (always firstBall, in that case), reflect the ball as if it hit a wall instead of trading speeds.
            let v1_post = { normal: v2.normal, tangent: v1.tangent };
            let v2_post = { normal: firstBall.stuck ? -v2.normal : v1.normal, tangent: v2.tangent };

            // Step 6
            let v1_vec = new Vec2(normal).scale(v1_post.normal).add(new Vec2(tangent).scale(v1_post.tangent));
            let v2_vec = new Vec2(normal).scale(v2_post.normal).add(new Vec2(tangent).scale(v2_post.tangent));

            // Step 7
            firstBall.velocity = v1_vec;
            secondBall.velocity = v2_vec;

            // Step 8, added by me: we can't really have 100% physically accurate collisions in this game.
            // If the ball stops or moves extremely slowly, that just about ruins the gameplay, so we enforce a fixed
            // speed for all balls.
            firstBall.velocity.setMagnitude(this.settings.ballSpeed);
            secondBall.velocity.setMagnitude(this.settings.ballSpeed);

            // TODO: remove if not needed any longer
            firstBall.collided = true;
            secondBall.collided = true;

            while (Math.sqrt((firstBall.position.x - secondBall.position.x)**2 + (firstBall.position.y - secondBall.position.y)**2) < 2*this.settings.ballRadius) {
                // Ensure the balls aren't still intersecting, to prevent them from getting stuck together
                secondBall.position.x += secondBall.velocity.x * 3;
                secondBall.position.y += secondBall.velocity.y * 3;
            }

            if (Math.abs(firstBall.velocity.mag() - this.settings.ballSpeed) > 0.01 || Math.abs(secondBall.velocity.mag() - this.settings.ballSpeed) > 0.01)
                debugAlert("MATH ERROR: Ball speed incorrect after collision")

            // Handle the case of collisions in sticky + multiball combination. The stuck ball should stay stuck.
            if (firstBall.stuck) {
                firstBall.velocity.x = 0;
                firstBall.velocity.y = 0;
            }
        }
    }
}
