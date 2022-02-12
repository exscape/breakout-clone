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

    handleBallBallCollisions(balls: Ball[]) {
        // Build a list of all unique pairs (e.g. A+B, A+C, B+C -- but not also B+A, C+A, C+B), and check each for collisions.
        let ballPairs = generatePairs(balls);
        for (let pair of ballPairs) {
            // This only runs if there are at least two balls present.
            let [firstBall, secondBall] = pair;

            let distance = Math.sqrt((firstBall.position.x - secondBall.position.x)**2 + (firstBall.position.y - secondBall.position.y)**2);

            if (distance < 2 * this.settings.ballRadius) {
                // TODO: reduce allocation here?
                // Based on: https://imada.sdu.dk/~rolf/Edu/DM815/E10/2dcollisions.pdf

                // Step 1
                let normal = new Vec2(firstBall.position.x - secondBall.position.x, firstBall.position.y - secondBall.position.y);

                // Rare, but happens in testing when you launch a TON of balls straight up and let them bounce.
                // Causes major bugs if not handled. Ignoring the collision is not ideal, but this is SO unlikely to happen
                // in a normal gaming situation, *AND* if it happens it's not a big deal at all to skip the collision.
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
                let v1_normal_post = v2_normal_pre;
                let v2_normal_post = v1_normal_pre;

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
                    // TODO: this doesn't work -- if the balls are moving together yet intersecting this is an infinite loop!
                    firstBall.position.x += firstBall.velocity.x * 3;
                    firstBall.position.y += firstBall.velocity.y * 3;
                }

                if (Math.abs(firstBall.velocity.mag() - this.settings.ballSpeed) > 0.01 || Math.abs(secondBall.velocity.mag() - this.settings.ballSpeed) > 0.01)
                    alert("MATH ERROR: Ball speed incorrect after collision")
            }
        }
    }
}