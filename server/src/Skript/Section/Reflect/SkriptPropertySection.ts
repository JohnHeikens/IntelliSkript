import { PatternData } from '../../../Pattern/PatternData';
import { PatternTree } from '../../../Pattern/PatternTree';
import { PatternType } from '../../../Pattern/PatternType';
import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection';
import { SkriptExpressionSection } from './SkriptExpressionSection';
import { SkriptTypeState } from '../../SkriptTypeState';
import assert = require('assert');
export class SkriptPropertySection extends SkriptExpressionSection {
	propertyParentType: PatternData;
	constructor(context: SkriptContext, propertyParentType: PatternData, parent?: SkriptSection) {
		super(context, parent);
		this.propertyParentType = propertyParentType;
	}
	override addPattern(context: SkriptContext): void {
		const p = PatternTree.parsePattern(context, this, PatternType.effect);
		if (p) {

			const typeState = new SkriptTypeState(this.propertyParentType);
			//generate 2 patterns with this information
			const p1 = new PatternData("%'s " + p.skriptPatternString, "%'s " + p.regexPatternString, p.definitionLocation, [typeState, ...p.expressionArguments], PatternType.effect, this);
			const p2 = new PatternData(p.skriptPatternString + " of %", p.regexPatternString + "of %", p.definitionLocation, [...p.expressionArguments, typeState], PatternType.effect, this);

			assert(context.currentSkriptFile != undefined);
			context.currentSkriptFile.addPattern(p1);
			context.currentSkriptFile.addPattern(p2);
		}
	}
}