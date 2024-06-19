import { PatternData, TypeData } from '../../../Pattern/Data/PatternData';
import { PatternTree } from '../../../Pattern/PatternTree';
import { PatternType } from '../../../Pattern/PatternType';
import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection/SkriptSection';
import { SkriptExpressionSection } from './SkriptExpressionSection';
import { SkriptTypeState } from '../../SkriptTypeState';
import assert = require('assert');
export class SkriptPropertySection extends SkriptExpressionSection {
	propertyParentType: TypeData;
	constructor(context: SkriptContext, propertyParentType: TypeData, parent?: SkriptSection) {
		super(context, parent);
		this.propertyParentType = propertyParentType;
	}
	override addPattern(context: SkriptContext): void {
		const p = PatternTree.parsePattern(context, this, PatternType.effect);
		if (p) {

			const typeState = new SkriptTypeState(this.propertyParentType);
			//generate 2 patterns with this information
			//patterns will be "%'s position" and "position of %"
			const p1 = new PatternData("%'s " + p.skriptPatternString, "%'s " + p.regexPatternString, p.definitionLocation, PatternType.effect, this, [typeState, ...p.expressionArguments]);
			const p2 = new PatternData(p.skriptPatternString + " of %", p.regexPatternString + "of %", p.definitionLocation, PatternType.effect, this, [...p.expressionArguments, typeState]);

			assert(context.currentSkriptFile != undefined);
			context.currentSkriptFile.addPattern(p1);
			context.currentSkriptFile.addPattern(p2);
		}
	}
}