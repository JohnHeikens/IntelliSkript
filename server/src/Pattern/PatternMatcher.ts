import { PatternTreeContainer } from './PatternTreeContainer';
import { SkriptPatternCall } from './SkriptPattern';
import { MatchResult } from './match/matchResult';
export interface PatternMatcher {
    getPatternData(testPattern: SkriptPatternCall): MatchResult | undefined;
}