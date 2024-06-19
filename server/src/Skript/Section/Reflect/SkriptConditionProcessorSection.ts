import { TokenTypes } from '../../../TokenTypes';
import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection/SkriptSection';
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';

export class SkriptConditionProcessorSection extends SkriptPatternContainerSection {
	createSection(context: SkriptContext): SkriptSection {
		const regex = /^(check)$/;
		const result = regex.exec(context.currentString);
		const bool = this.getTypeData("boolean");
		if (bool) {
			this.returnType.possibleTypes.push(bool);
		}

		if (result) {
			context.addToken(TokenTypes.keyword, 0, context.currentString.length);
			return new SkriptSection(context, this);
		}
		else return super.createSection(context);
	}
}