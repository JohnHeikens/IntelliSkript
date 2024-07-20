//https://stackoverflow.com/questions/1344500/efficient-way-to-insert-a-number-into-a-sorted-array-of-numbers
/**
 * 
 * @param array 
 * @param value 
 * @param compare should return a < b
 * @returns 
 */
export function sortedIndex<t>(array: Array<t>, value: t, compare: (a: t, b: t) => boolean, low: number = 0, high: number = array.length) {
    while (low < high) {
        var mid = (low + high) >>> 1;
        //array[mid] < value
        if (compare(array[mid], value)) low = mid + 1;
        else high = mid;
    }
    return low;
}
