import { Vec2 } from "./Vec2";

export type PowerupType = "sticky" | "multiball" | "fireball" | "extralife" | "ultrawide";

export abstract class Powerup {
    type: PowerupType;
    name: string;
    pickupScore: number;

    expired: boolean = false;
    image: string;
    position: Vec2;
    phase: number; // Used for animation of the powerup icon

    activatedCallback: null | (() => void) = null;
    deactivatedCallback: null | (() => void) = null;

    active: boolean = false; // Has this been picked up?

    constructor(type: PowerupType, position: Vec2, pickupScore: number) {
        this.type = type;
        this.name = type.toString();
        this.image = `powerup_${type.toString()}`;
        this.position = position;
        this.phase = 0;
        this.pickupScore = pickupScore;
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

    addInstance() {
        throw new Error("addInstance called when not overridden in subclass");
    }
}

export abstract class TimeLimitedPowerup extends Powerup {
    activeTime: number = 0;
    maxTimeActive: number;
    readonly originalMaxTimeActive: number;

    constructor(type: PowerupType, position: Vec2, pickupScore: number, maxTimeActive: number) {
        super(type, position, pickupScore);
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

export abstract class InstantEffectPowerup extends Powerup {
    constructor(type: PowerupType, position: Vec2, pickupScore: number) {
        super(type, position, pickupScore);
    }
}

export abstract class RepetitionLimitedPowerup extends Powerup {
    readonly originalMaxRepetitions: number;
    maxRepetitions: number;
    repetitions = 0;

    constructor(type: PowerupType, position: Vec2, pickupScore: number, maxRepetitions: number) {
        super(type, position, pickupScore);
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
        super("sticky", position, 75, 5);
    }
}

export class MultiballPowerup extends RepetitionLimitedPowerup {
    constructor(position: Vec2) {
        super("multiball", position, 100, 4);
    }
}

export class FireballPowerup extends TimeLimitedPowerup {
    constructor(position: Vec2) {
        super("fireball", position, 125, 8000);
    }
}

export class UltrawidePowerup extends TimeLimitedPowerup {
    constructor(position: Vec2) {
        super("ultrawide", position, 100, 15000);
    }
}

export class ExtraLifePowerup extends InstantEffectPowerup {
    constructor(position: Vec2) {
        super("extralife", position, 200);
    }
}
