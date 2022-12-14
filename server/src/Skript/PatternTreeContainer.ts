import { PatternTree, PatternData, patternResultProcessor } from '../PatternTree';
import { SkriptContext } from './SkriptContext';
import { SkriptPatternContainerSection } from './Section/Reflect/SkriptPatternContainerSection';

export enum PatternType {
	effect,
	event,
	count
}

export class PatternTreeContainer {
	trees = new Array<PatternTree>(PatternType.count);
	constructor() {
		for (let i = 0; i < PatternType.count; i++) {
			this.trees[i] = new PatternTree();
		}
	}
	getPatternData(testString: string, shouldContinue: patternResultProcessor, type: PatternType = PatternType.effect): PatternData | undefined {
		return this.trees[type].getMatchingPatterns(testString, shouldContinue);
	}

	addPattern(context: SkriptContext, section: SkriptPatternContainerSection, type: PatternType): void {
		this.trees[type].addPattern(context, section);
	}

	merge(other: PatternTreeContainer): void {
		for (let i = 0; i < PatternType.count; i++) {
			this.trees[i].merge(other.trees[i]);
		}
	}
}