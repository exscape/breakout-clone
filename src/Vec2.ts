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

    scale(scalar: number): void {
        this.x *= scalar;
        this.y *= scalar;
    }

    add(other: Vec2): void {
        this.x += other.x;
        this.y += other.y;
    }

    normalize(): void {
        const m = this.mag();
        if (m == 0)
            return; // A normalized 0-length vector is a 0-length vector
        this.x /= m;
        this.y /= m;
        if (Math.abs(1 - this.mag()) > 0.01)
            debugAlert("MATH ERROR: normalize() didn't yield a length-1 vector");
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
