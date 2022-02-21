import { debugAlert } from "./Utils";

export class Vec2 {
    x: number;
    y: number;

    constructor(x: number | Vec2 = 0, y: number = 0) {
        if (typeof x === "number") {
            this.x = x;
            this.y = y;
        }
        else {
            // Create a copy of this vector
            this.x = x.x;
            this.y = x.y;
        }
    }

    mag(): number {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }

    dot(other: Vec2): number {
        return this.x * other.x + this.y * other.y;
    }

    scale(scalar: number): Vec2 {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    add(other: Vec2): Vec2 {
        this.x += other.x;
        this.y += other.y;
        return this;
    }

    subtract(other: Vec2): Vec2 {
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }

    normalize(): Vec2 {
        const m = this.mag();
        if (m == 0)
            return this; // A normalized 0-length vector is a 0-length vector
        this.x /= m;
        this.y /= m;
        if (Math.abs(1 - this.mag()) > 0.01)
            debugAlert("MATH ERROR: normalize() didn't yield a length-1 vector");

        return this;
    }

    setMagnitude(mag: number): void {
        // Scale this vector such that the direction is unchanged, but the magnitude mathes the argument.
        this.normalize();
        this.x *= mag;
        this.y *= mag;
        if (Math.abs(this.mag() - mag) > 0.01)
            debugAlert("MATH ERROR: setMagnitude failed");
    }

}

// Basically just as simple class to store integral x and y coordinates for bricks.
export class BrickPosition {
    x: number;
    y: number;

    constructor(x: number | BrickPosition = 0, y: number = 0) {
        if (typeof x === "number") {
            if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y))
                throw new Error("BrickPosition constructor called with non-integer argument(s)");
            this.x = x;
            this.y = y;
        }
        else {
            // Create a copy of this vector
            if (!Number.isSafeInteger(x.x) || !Number.isSafeInteger(x.y))
                throw new Error("BrickPosition constructor called with non-integer argument(s)");
            this.x = x.x;
            this.y = x.y;
        }
    }

    toString(): string {
        return `(${this.x},${this.y})`;
    }
}
