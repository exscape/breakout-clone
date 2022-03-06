import { clamp } from "./Utils";
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
    effectTime: number;
    readonly instanceEffectTime: number;
    readonly effectTimeCap: number;

    constructor(type: PowerupType, position: Vec2, pickupScore: number, effectTime: number, effectTimeCap: number) {
        super(type, position, pickupScore);
        this.effectTime = effectTime;
        this.instanceEffectTime = effectTime;
        this.effectTimeCap = effectTimeCap;
    }

    tick(dt: number) {
        if (!this.active)
            return;

        this.activeTime += dt;
        if (this.activeTime >= this.effectTime)
            this.expire();
    }

    addInstance() {
        // Called when we pick up another copy of this powerup while it's still active
        this.effectTime = clamp(this.effectTime + this.instanceEffectTime, 0, this.effectTimeCap);
    }
}

export abstract class InstantEffectPowerup extends Powerup {
    constructor(type: PowerupType, position: Vec2, pickupScore: number) {
        super(type, position, pickupScore);
    }
}

export abstract class RepetitionLimitedPowerup extends Powerup {
    // Number of repetitions per powerup; e.g. 3 for one pickup, 6 for two, 9 for three.
    readonly instanceRepetitionLimit: number;

    // Max number of repetitions, i.e. a cap. With a cap of 5, the above would look like 3, 5, 5.
    readonly repetitionCap: number;
    repetitionLimit: number;
    repetitions = 0;

    constructor(type: PowerupType, position: Vec2, pickupScore: number, repetitionLimit: number, repetitionCap: number) {
        super(type, position, pickupScore);
        this.repetitionLimit = repetitionLimit;
        this.instanceRepetitionLimit = repetitionLimit;
        this.repetitionCap = repetitionCap;
    }

    trigger() {
        this.repetitions++;
        if (this.repetitions >= this.repetitionLimit)
            this.expire();
    }

    addInstance() {
        // Called when we pick up another copy of this powerup while it's still active
        this.repetitionLimit = clamp(this.repetitionLimit + this.instanceRepetitionLimit, 0, this.repetitionCap);
    }
}

export class StickyPowerup extends RepetitionLimitedPowerup {
    constructor(position: Vec2) {
        super("sticky", position, 75, 3, 6);
    }
}

export class MultiballPowerup extends RepetitionLimitedPowerup {
    constructor(position: Vec2) {
        super("multiball", position, 100, 3, 6);
    }
}

export class FireballPowerup extends TimeLimitedPowerup {
    constructor(position: Vec2) {
        super("fireball", position, 125, 7500, 15000);
    }
}

export class UltrawidePowerup extends TimeLimitedPowerup {
    constructor(position: Vec2) {
        super("ultrawide", position, 100, 12500, 25000);
    }
}

export class ExtraLifePowerup extends InstantEffectPowerup {
    constructor(position: Vec2) {
        super("extralife", position, 200);
    }
}
