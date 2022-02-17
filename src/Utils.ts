export function generatePairs(list: any[]): any[] {
    let pairs: any[] = [];
    if (list.length < 2) return []
    else {
        for (let i = 0; i < list.length; i++) {
            for (let j = i+1; j < list.length; j++) {
                pairs.push([list[i], list[j]]);
            }
        }

        return pairs;
    }
}

export function clamp(v: number, min: number, max: number) {
    if (v < min)
        v = min;
    else if (v > max)
        v = max;
    return v;
}

export function debugAlert(s: string) {
    if (true) {
        console.error("DEBUG ALERT: " + s);
        alert(s);
    }
}

export function formatTime(s: number) {
    // t is in seconds
    let h = Math.floor(s / 3600);
    s %= 3600;
    let m = Math.floor(s / 60);
    s %= 60;
    let ret = "";
    if (h > 0)
        ret += `${h.toString().padStart(2, "0")}:`;
    ret += `${m.toString().padStart(2, "0")}:`;
    ret += `${s.toString().padStart(2, "0")}`;

    return ret;
}

export function lerp(a: number, b: number, r: number) {
    return a + (b - a) * clamp(r, 0, 1);
}
