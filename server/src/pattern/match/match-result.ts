import { PatternTreeNode } from '../pattern-tree-node/pattern-tree-node';
import { SkriptPatternCall } from '../skript-pattern';
import { PatternMatch } from './pattern-match';

/**contains the full match and submatches */
export class MatchResult {
    patternCall: SkriptPatternCall;
    fullMatch: PatternMatch;
	nodesPassed: PatternTreeNode[] = [];
    constructor(patternCall: SkriptPatternCall, fullMatch: PatternMatch) {
        this.patternCall = patternCall;
        this.fullMatch = fullMatch;
    }
}