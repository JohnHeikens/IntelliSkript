import { SkriptSection } from './SkriptSection';
import { SkriptVariable } from '../SkriptVariable';
import { Hierarchy } from '../../Hierarchy';
import { PatternData, patternResultProcessor } from '../../PatternTree';
import { PatternType } from '../PatternTreeContainer';

export class SkriptSectionGroup extends Hierarchy<SkriptSectionGroup> {
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
	getPatternData(pattern: string, shouldContinue: patternResultProcessor, patternType: PatternType): PatternData | undefined {
		return this.parent ? this.parent.getPatternData(pattern, shouldContinue, patternType) : undefined;
	}
}