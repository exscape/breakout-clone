import { Vec2 } from "./Vec2";

export type PowerupType = "sticky" | "multiball";

export abstract class Powerup {
    type: PowerupType;
    name: string;

    expired: boolean = false;
    image: string;
    position: Vec2;

    activatedCallback: null | (() => void) = null;
    deactivatedCallback: null | (() => void) = null;

    active: boolean = false; // Has this been picked up?

    constructor(type: PowerupType, position: Vec2) {
        this.type = type;
        this.name = type.toString();
        this.image = `powerup_${type.toString()}`;
        this.position = position;
    }

    activate() {
        this.active = true;
        if (this.activatedCallback) this.activatedCallback();
    }

    isActive(): boolean {
        return this.active;
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

export abstract class TimeLimitedPowerup extends Powerup {
    activeTime: number = 0;
    maxTimeActive: number;
    readonly originalMaxTimeActive: number;

    constructor(type: PowerupType, position: Vec2, maxTimeActive: number = Number.POSITIVE_INFINITY) {
        super(type, position);
        this.maxTimeActive = maxTimeActive;
        this.originalMaxTimeActive = maxTimeActive;
    }

    tick(dt: number) {
        if (!this.active)
            return;

        this.activeTime += dt;
        if (this.activeTime >= this.maxTimeActive)
            this.expire();
    }

    addInstance() {
        // Called when we pick up another copy of this powerup while it's still active
        this.maxTimeActive += this.originalMaxTimeActive;
    }
}

export abstract class RepetitionLimitedPowerup extends Powerup {
    readonly originalMaxRepetitions: number;
    maxRepetitions: number;
    repetitions = 0;

    constructor(type: PowerupType, position: Vec2, maxRepetitions: number) {
        super(type, position);
        this.maxRepetitions = maxRepetitions;
        this.originalMaxRepetitions = maxRepetitions;
    }

    trigger() {
        this.repetitions++;
        if (this.repetitions >= this.maxRepetitions)
            this.expire();
    }

    addInstance() {
        // Called when we pick up another copy of this powerup while it's still active
        this.maxRepetitions += this.originalMaxRepetitions;
    }
}

export class StickyPowerup extends RepetitionLimitedPowerup {
    constructor(position: Vec2) {
        super("sticky", position, 10);
    }
}

export class MultiballPowerup extends RepetitionLimitedPowerup {
    constructor(position: Vec2) {
        super("multiball", position, 4);
    }
}