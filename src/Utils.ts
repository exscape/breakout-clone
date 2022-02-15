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