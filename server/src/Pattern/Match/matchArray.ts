import { PatternData } from '../data/PatternData';
import { SkriptPatternCall } from '../SkriptPattern';
import { PatternMatch } from './PatternMatch'

export class MatchArray {
    patternCall: SkriptPatternCall;
    matches: PatternMatch[] = [];
    hasFullMatch = false;
    constructor(patternCall: SkriptPatternCall) {
        this.patternCall = patternCall;
    }
    addMatches(other: MatchArray): MatchArray {
        this.matches.push(...other.matches);
        this.hasFullMatch ||= other.hasFullMatch;
        return this;
    }
    addMatch(match: PatternMatch) {
        //get index of
        this.matches.push(match);
    }
    /**
     * sort the matches from big to small
     */
    sortMatches() {
    }
    getFullMatch(): PatternData | undefined {
        this.sortMatches();
        return this.hasFullMatch ? this.matches[0].matchedPattern : undefined;
    }
}