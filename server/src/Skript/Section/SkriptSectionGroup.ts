import { Hierarchy } from '../../Hierarchy';
import { PatternData } from "../../Pattern/Data/PatternData";
import { PatternResultProcessor } from "../../Pattern/patternResultProcessor";
import { SkriptVariable } from '../SkriptVariable';
import { SkriptSection } from './SkriptSection/SkriptSection';
import { PatternMatcher } from '../../Pattern/PatternMatcher';
import { SkriptPatternCall } from '../../Pattern/SkriptPattern';

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