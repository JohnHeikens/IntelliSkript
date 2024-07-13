import { SkriptContext } from '../validation/SkriptContext';
import { SkriptOption } from '../storage/SkriptOption';
import { SkriptSection } from './skriptSection/SkriptSection';
import { TokenTypes } from '../../TokenTypes';
import { TokenModifiers } from '../../TokenModifiers';
export class SkriptOptionsSection extends SkriptSection {
	processLine(context: SkriptContext): void {
		const colonIndex = context.currentString.indexOf(": ");
		if (colonIndex == -1) {
			context.addDiagnostic(0, context.currentString.length, "this is not an option")
		} else {
			const optionName = context.currentString.substring(0, colonIndex);
			const optionValue = context.currentString.substring(colonIndex).trim();
			context.currentSkriptFile?.options.push(new SkriptOption(optionName, optionValue));
			context.addToken(TokenTypes.variable, 0, colonIndex, [TokenModifiers.readonly, TokenModifiers.static, TokenModifiers.definition])
		}
	}
}