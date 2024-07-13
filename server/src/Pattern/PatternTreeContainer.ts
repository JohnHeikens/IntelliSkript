import { PatternData } from "../pattern/data/PatternData";
import { PatternTree } from '../pattern/PatternTree';
import { PatternResultProcessor } from "../pattern/patternResultProcessor";
import { PatternType } from '../pattern/PatternType';
import type { SkriptPatternContainerSection } from '../skript/section/reflect/SkriptPatternContainerSection';
import { SkriptContext } from '../skript/validation/SkriptContext';
import { PatternMatcher } from '../pattern/PatternMatcher';
import { SkriptPatternCall } from '../pattern/SkriptPattern';
import { MatchArray } from './match/matchArray';

export class PatternTreeContainer implements PatternMatcher {
	trees = new Array<PatternTree>(PatternType.count);
	constructor() {
		for (let i = 0; i < PatternType.count; i++) {
			this.trees[i] = new PatternTree();
		}
	}
	getPatternData(testPattern: SkriptPatternCall): MatchArray {
		return this.trees[testPattern.type].getPatternData(testPattern);
	}

	addPattern(pattern: PatternData): void {
		this.trees[pattern.patternType].addPattern(pattern);
	}

	merge(other: PatternTreeContainer): void {
		for (let i = 0; i < PatternType.count; i++) {
			this.trees[i].merge(other.trees[i]);
		}
	}
}