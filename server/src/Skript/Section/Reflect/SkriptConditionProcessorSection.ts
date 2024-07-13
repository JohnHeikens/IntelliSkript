import { PatternType } from '../../../pattern/PatternType';
import { TokenTypes } from '../../../TokenTypes';
import { SkriptContext } from '../../validation/SkriptContext';
import { SkriptSection } from '../skriptSection/SkriptSection';
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';

export class SkriptConditionProcessorSection extends SkriptPatternContainerSection {
	static patternType = PatternType.condition;
	createSection(context: SkriptContext): SkriptSection | undefined {
		const regex = /^(check)$/;
		const result = regex.exec(context.currentString);
		const bool = this.getTypeData("boolean");
		if (bool) {
			this.returnType.possibleTypes.push(bool);
		}

		if (result) {
			context.addToken(TokenTypes.keyword, 0, context.currentString.length);
			return new SkriptSection(this, context);
		}
		else return super.createSection(context);
	}
}