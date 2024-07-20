import { Hierarchy } from '../../Hierarchy';
import { PatternData } from "../../pattern/data/PatternData";
import { PatternResultProcessor } from "../../pattern/patternResultProcessor";
import { SkriptVariable } from '../storage/SkriptVariable';
import { SkriptSection } from './skriptSection/SkriptSection';
import { PatternMatcher } from '../../pattern/PatternMatcher';
import { SkriptPatternCall } from '../../pattern/SkriptPattern';
import { MatchResult } from '../../pattern/match/matchResult';
import { PatternTreeContainer } from '../../pattern/PatternTreeContainer';

export class SkriptSectionGroup extends Hierarchy<SkriptSectionGroup> implements PatternMatcher {
	patternContainer?: PatternTreeContainer;
	definedVariables: Array<SkriptVariable> = [];
	override children: SkriptSectionGroup[] = [];
	constructor(parent?: SkriptSectionGroup) {
		super(parent);
	}

	getVariableByName(name: string): SkriptVariable | undefined {
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