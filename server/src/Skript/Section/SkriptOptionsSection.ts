import { SkriptContext } from '../SkriptContext';
import { SkriptOption } from '../SkriptOption';
import { SkriptSection } from './SkriptSection';
export class SkriptOptionsSection extends SkriptSection {
	processLine(context: SkriptContext): void {
		const colonIndex = context.currentString.indexOf(": ");
		const optionName = context.currentString.substring(0, colonIndex);
		const optionValue = context.currentString.substring(colonIndex).trim();
		context.currentSkriptFile?.options.push(new SkriptOption(optionName, optionValue));

	}
}