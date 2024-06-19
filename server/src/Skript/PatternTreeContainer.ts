import { PatternData } from "../Pattern/Data/PatternData";
import { PatternTree } from '../Pattern/PatternTree';
import { PatternResultProcessor } from "../Pattern/patternResultProcessor";
import { PatternType } from '../Pattern/PatternType';
import type { SkriptPatternContainerSection } from './Section/Reflect/SkriptPatternContainerSection';
import { SkriptContext } from './SkriptContext';
import { PatternMatcher } from '../Pattern/PatternMatcher';
import { SkriptPatternCall } from '../Pattern/SkriptPattern';

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