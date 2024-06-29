import { PatternData } from "../pattern/data/PatternData";
import { PatternTree } from '../pattern/PatternTree';
import { PatternResultProcessor } from "../pattern/patternResultProcessor";
import { PatternType } from '../pattern/PatternType';
import type { SkriptPatternContainerSection } from '../skript/section/reflect/SkriptPatternContainerSection';
import { SkriptContext } from '../skript/validation/SkriptContext';
import { PatternMatcher } from '../pattern/PatternMatcher';
import { SkriptPatternCall } from '../pattern/SkriptPattern';

export class PatternTreeContainer implements PatternMatcher {
	trees = new Array<PatternTree>(PatternType.count);
	constructor() {
		for (let i = 0; i < PatternType.count; i++) {
			this.trees[i] = new PatternTree();
		}
	}
	getPatternData(testPattern: SkriptPatternCall, shouldContinue: PatternResultProcessor): PatternData | undefined {
		return this.trees[testPattern.type].getPatternData(testPattern, shouldContinue);
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