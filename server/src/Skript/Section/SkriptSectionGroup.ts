import { Hierarchy } from '../../Hierarchy';
import { PatternMatcher } from '../../pattern/PatternMatcher';
import { PatternTreeContainer } from '../../pattern/PatternTreeContainer';
import { SkriptPatternCall } from '../../pattern/SkriptPattern';
import { SkriptVariable } from '../storage/SkriptVariable';

export class SkriptSectionGroup extends Hierarchy<SkriptSectionGroup> implements PatternMatcher {
	patternContainer?: PatternTreeContainer;
	definedVariables: Array<SkriptVariable> = [];
	override children: SkriptSectionGroup[] = [];
	constructor(parent?: SkriptSectionGroup) {
		super(parent);
	}

	getVariableByName(_name: string): SkriptVariable | undefined {
		//throw new Error("skriptsectiongroup without derivation");
		return undefined;
	}


	/**
	 * returns the pattern tree of this pattern matcher, which should be set as the parent of any pattern tree of children.
	 */
	getPatternTree(): PatternTreeContainer | undefined {
		return this.patternContainer ?? this.parent?.getPatternTree();
	}

	getPatternData(testPattern: SkriptPatternCall) {
		return this.getPatternTree()?.getPatternData(testPattern);
	};
}