import { SkriptPatternCall } from './SkriptPattern';
import { PatternData } from './data/PatternData';
import { MatchArray } from './match/matchArray';
export interface PatternMatcher {
    getPatternData(testPattern: SkriptPatternCall): PatternData | undefined;
}