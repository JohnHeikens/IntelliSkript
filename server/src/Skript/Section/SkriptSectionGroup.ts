import { Hierarchy } from '../../Hierarchy';
import { PatternData } from "../../pattern/data/PatternData";
import { PatternResultProcessor } from "../../pattern/patternResultProcessor";
import { SkriptVariable } from '../storage/SkriptVariable';
import { SkriptSection } from './skriptSection/SkriptSection';
import { PatternMatcher } from '../../pattern/PatternMatcher';
import { SkriptPatternCall } from '../../pattern/SkriptPattern';

export class SkriptSectionGroup extends Hierarchy<SkriptSectionGroup> implements PatternMatcher {
	definedVariables: Array<SkriptVariable> = [];
	override children: SkriptSectionGroup[] = [];
	constructor(parent?: SkriptSectionGroup) {
		super(parent);
	}

	getVariableByName(name: string): SkriptVariable | undefined {
		//throw new Error("skriptsectiongroup without derivation");
		return undefined;
	}
	getPatternData(testPattern: SkriptPatternCall, shouldContinue: PatternResultProcessor): PatternData | undefined {
		return this.parent?.getPatternData(testPattern, shouldContinue);
	}
}