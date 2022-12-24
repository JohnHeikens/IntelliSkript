import { Hierarchy } from '../../Hierarchy';
import { PatternData } from "../../Pattern/PatternData";
import { PatternResultProcessor } from "../../Pattern/patternResultProcessor";
import { SkriptVariable } from '../SkriptVariable';
import { SkriptSection } from './SkriptSection';
import { PatternMatcher } from '../../Pattern/PatternMatcher';
import { SkriptPatternCall } from '../../Pattern/SkriptPattern';

export class SkriptSectionGroup extends Hierarchy<SkriptSectionGroup> implements PatternMatcher {
	definedVariables: Array<SkriptVariable> = [];
	override children: SkriptSection[] = [];
	constructor(parent?: SkriptSectionGroup) {
		super(parent);
	}
	getChildSectionAtLine(line: number): SkriptSection | undefined {
		for (let i = 0; i < this.children.length; i++) {
			if (line >= this.children[i].startLine && line <= this.children[i].endLine) {
				return this.children[i];
			}
		}
		return undefined;
	}
	getVariableByName(name: string): SkriptVariable | undefined {
		//throw new Error("skriptsectiongroup without derivation");
		return undefined;
	}
	getPatternData(testPattern: SkriptPatternCall, shouldContinue: PatternResultProcessor): PatternData | undefined {
		return this.parent ? this.parent.getPatternData(testPattern, shouldContinue) : undefined;
	}
}