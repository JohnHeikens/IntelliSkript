import { PatternData } from './PatternData';
import { SkriptPatternCall } from './SkriptPattern';
import { PatternResultProcessor } from './patternResultProcessor';
import { PatternType } from './PatternType';
export interface PatternMatcher {
    getPatternData(testPattern: SkriptPatternCall, shouldContinue: PatternResultProcessor): PatternData | undefined;
    
}