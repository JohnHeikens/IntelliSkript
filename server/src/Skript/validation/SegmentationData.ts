import { SkriptPatternCall } from '../../pattern/SkriptPattern';

interface callHistoryElement {
    call: SkriptPatternCall;
    offset: number;
}

export class SegmentationData {
    constructor(recursion: number = 0, segmentateFrom: number = 0, calls: Map<number, callHistoryElement[]> = new Map<number, callHistoryElement[]>()){
        this.recursion = recursion;
        this.segmentateFrom = segmentateFrom;
        this.calls = calls;
    }
    compareElements(a: callHistoryElement, b: callHistoryElement): boolean {
        return a.offset == b.offset && a.call.compareCalls(b.call);
    }
    //is a reference and stores all pattern calls we tried, so we don't try the same combination twice at the same place
    calls: Map<number, callHistoryElement[]>;
    addCall(call: callHistoryElement): boolean {

        let callList = this.calls.get(call.offset);
        if (callList) {
            for (const elem of callList) {
                if (this.compareElements(elem, call))
                    return false;
            }
        }
        else
            this.calls.set(call.offset, []);
        callList?.push(call);
        return true;
    }

    recursion: number;
    segmentateFrom: number;
}