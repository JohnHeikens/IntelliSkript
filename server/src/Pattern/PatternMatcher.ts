import { SkriptPatternCall } from './SkriptPattern';
import { MatchArray } from './match/matchArray';
export interface PatternMatcher {
    getPatternData(testPattern: SkriptPatternCall): MatchArray;
}