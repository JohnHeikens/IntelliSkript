import { NestHierarchy } from '../../nesting/NestHierarchy';
import { PatternData } from '../data/PatternData';

export class PatternMatch extends NestHierarchy<PatternMatch> {
    matchedPattern: PatternData;
    //the endindex in the pattern call.
    //so for example, when the pattern call would be '1 tick' and '1' would be matched, the endindex would be 1, because the length of '1' is one.
    //or when '% tick' would be matched, the endindex would be 6, because the length of '1 tick' is 6.
    start: number = 0;
    end: number = 0;
    constructor(matchedPattern: PatternData, start: number, end: number) {
        super(start, end);
        this.matchedPattern = matchedPattern;
        this.start = start;
        this.end = end;
    }
}