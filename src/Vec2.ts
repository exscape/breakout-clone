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
        this.x /= m;
        this.y /= m;
        if (Math.abs(1 - this.mag()) > 0.01)
            alert("MATH ERROR: normalize() didn't yield a length-1 vector");
    }

    // Like normalize(), but returns a copy instead
    normalized(): Vec2 {
        let v = new Vec2(this);
        v.normalize();
        return v;
    }
}