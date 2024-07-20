import { PatternData } from '../data/PatternData';
import { SkriptPatternCall } from '../SkriptPattern';
import { PatternMatch } from './PatternMatch'

/**contains the full match and submatches */
export class MatchResult {
    patternCall: SkriptPatternCall;
    fullMatch: PatternMatch;
    constructor(patternCall: SkriptPatternCall, fullMatch: PatternMatch) {
        this.patternCall = patternCall;
        this.fullMatch = fullMatch;
    }
}