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