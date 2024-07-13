import { PatternData } from '../data/PatternData';

export class PatternMatch {
    matchedPattern: PatternData;
    //the endindex in the pattern call.
    //so for example, when the pattern call would be '1 tick' and '1' would be matched, the endindex would be 1, because the length of '1' is one.
    //or when '% tick' would be matched, the endindex would be 6, because the length of '1 tick' is 6.
    endIndex: number = 0;
    constructor(matchedPattern: PatternData, endIndex: number) {
        this.matchedPattern = matchedPattern;
        this.endIndex = endIndex;
    }
}