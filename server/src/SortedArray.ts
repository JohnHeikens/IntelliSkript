export class SortedArray<T> extends Array<T> {
    indexOf(searchElement: T, fromIndex?: number): number {

        var low = fromIndex ? fromIndex : 0,
            high = this.length;

        while (low < high) {
            var mid = (low + high) >>> 1;
            if (this[mid] < searchElement) low = mid + 1;
            else high = mid;
        }
        return low;
    }
    push(item: T): number {
        let index = this.indexOf(item);
        super.splice(index, 0, item)
        return this.length;
    }
}