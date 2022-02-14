import { Vec2 } from "./Vec2";

export type PowerupType = "sticky";

export abstract class Powerup {
    type: PowerupType;
    expired: boolean = false;
    image: string;
    position: Vec2;

    activatedCallback: null | (() => void) = null;
    deactivatedCallback: null | (() => void) = null;

    active: boolean = false; // Has this been picked up?
    activeTime: number = 0;
    readonly maxTimeActive: number;

    constructor(type: PowerupType, position: Vec2, maxTimeActive: number = Number.POSITIVE_INFINITY) {
        this.type = type;
        this.image = `powerup_${type.toString()}`;
        this.maxTimeActive = maxTimeActive;
        this.position = position;
    }

    activate() {
        this.active = true;
        if (this.activatedCallback) this.activatedCallback();
    }

    isActive(): boolean {
        return this.active;
    }

    tick(dt: number) {
        if (!this.active)
            return;

        this.activeTime += dt;
        if (this.activeTime >= this.maxTimeActive)
            this.expire();
    }

    expire() {
        this.expired = true;
        if (this.deactivatedCallback) this.deactivatedCallback();
    }

    setActivatedCallback(callback: () => void) {
        this.activatedCallback = callback;
    }

    setDeactivatedCallback(callback: () => void) {
        this.deactivatedCallback = callback;
    }
}

export class StickyPowerup extends Powerup {
    readonly maxLaunches = 10;
    launches = 0;

    constructor(position: Vec2) {
        super("sticky", position);
    }

    trigger() {
        this.launches++;
        if (this.launches >= this.maxLaunches)
            this.expire();
    }
}

/*
class MultiballPowerup extends Powerup {
    constructor() {
        super("multiball");
    }

    trigger() {

    }
}
*/