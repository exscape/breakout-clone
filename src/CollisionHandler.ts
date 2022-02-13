import { Ball } from './Ball';
import { Brick } from './Brick';
import { Settings } from './Settings';
import { Vec2 } from './Vec2';
import { generatePairs } from './Utils';

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

        // TODO: ensure we don't move the ball it into ANOTHER brick instead!!!
        // TODO: though that SHOULD be impossible -- if we came from e.g. the right, surely the right has no brick?

        if (direction == CollisionFrom.Top || direction == CollisionFrom.Bottom) {
            ball.velocity.y = -ball.velocity.y;

            // *Subtract* this from the ball's position and it will no longer overlap
            let verticalOverlap = (direction == CollisionFrom.Top) ? ball.position.y + this.settings.ballRadius - brick.upperLeft.y + 2   // e.g. 460 - 455 = 5
                                                                   : ball.position.y - this.settings.ballRadius - brick.bottomLeft.y - 2; // e.g. 500 - 505 = -5
            ball.position.y -= verticalOverlap;

            if (direction == CollisionFrom.Top && Math.sign(ball.velocity.y) != -1)
                alert("MATH ERROR: moving wrong direction after collision (top hit)");
            else if (direction == CollisionFrom.Bottom && Math.sign(ball.velocity.y) != 1)
                alert("MATH ERROR: moving wrong direction after collision (bottom hit)");
        }
        else {
            ball.velocity.x = -ball.velocity.x;

            // *Subtract* this from the ball's position and it will no longer overlap
            let horizontalOverlap = (direction == CollisionFrom.Left) ? ball.position.x + this.settings.ballRadius - brick.upperLeft.x + 2   // e.g. 460 - 455 = 5
                                                                      : ball.position.x - this.settings.ballRadius - brick.upperRight.x - 2; // e.g. 500 - 505 = -5
            ball.position.x -= horizontalOverlap;

            if (direction == CollisionFrom.Left && Math.sign(ball.velocity.x) != -1)
                alert("MATH ERROR: moving wrong direction after collision (left hit)");
            else if (direction == CollisionFrom.Right && Math.sign(ball.velocity.x) != 1)
                alert("MATH ERROR: moving wrong direction after collision (right hit)");
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
            // (i.e along the axis connecting the ball centers) while the stuck ball is not affected at all.
            if (secondBall.stuck)
                [firstBall, secondBall] = [secondBall, firstBall];
            if (secondBall.stuck)
                alert("BUG: firstBall stuck despite swap -- multiple stuck balls!");

            // TODO: reduce allocation here?

            // Step 1
            let normal = new Vec2(firstBall.position.x - secondBall.position.x, firstBall.position.y - secondBall.position.y);

            // Rare, but happens in testing when you launch a TON of balls straight up and let them bounce.
            // Causes major bugs if not handled. Ignoring the collision is not ideal, but this is SO unlikely to happen
            // in a normal gaming situation, *AND* if it happens it's not a big deal at all to skip the collision.
            // Note that testing against exactly zero is intended; values near zero are fine, as we can normalize those vectors.
            if (normal.mag() == 0)
                continue;

            normal.normalize();
            let tangent = new Vec2(-normal.y, normal.x);
            if (Math.abs(1-tangent.mag()) > 0.01)
                alert("MATH ERROR: tangent vector not a unit vector");

            // Step 3 and 4 (step 2 is not necessary)
            let v1_normal_pre = normal.dot(firstBall.velocity);
            let v1_tangent = tangent.dot(firstBall.velocity);
            let v2_normal_pre = normal.dot(secondBall.velocity);
            let v2_tangent = tangent.dot(secondBall.velocity);

            // Step 5 (for balls with equal mass)
            // If one ball is stuck (always firstBall, in that case), reflect the ball as if it hit a wall instead of trading speeds.
            let v1_normal_post = v2_normal_pre;
            let v2_normal_post = firstBall.stuck ? -v2_normal_pre : v1_normal_pre;

            // Step 6
            let v1_normal_vec = new Vec2(normal);
            v1_normal_vec.scale(v1_normal_post);
            let v1_tangent_vec = new Vec2(tangent);
            v1_tangent_vec.scale(v1_tangent);
            let v2_normal_vec = new Vec2(normal);
            v2_normal_vec.scale(v2_normal_post);
            let v2_tangent_vec = new Vec2(tangent);
            v2_tangent_vec.scale(v2_tangent);

            // Step 7
            firstBall.velocity = v1_normal_vec;
            firstBall.velocity.add(v1_tangent_vec);
            secondBall.velocity = v2_normal_vec;
            secondBall.velocity.add(v2_tangent_vec);

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
                alert("MATH ERROR: Ball speed incorrect after collision")

            // Handle the case of collisions in sticky + multiball combination. The stuck ball should stay stuck.
            if (firstBall.stuck) {
                firstBall.velocity.x = 0;
                firstBall.velocity.y = 0;
            }
        }
    }
}