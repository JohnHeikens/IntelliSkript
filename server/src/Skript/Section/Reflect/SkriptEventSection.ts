import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection';
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';
export class SkriptEventSection extends SkriptPatternContainerSection {
	eventValues: string[] | undefined = undefined;

	createSection(context: SkriptContext): SkriptSection {
		const regex = /^(pattern(|s))$/;
		const result = regex.exec(context.currentString);


		if (result == null){
			context.addDiagnostic(0, context.currentString.length, "cannot recognize this section");
		}
		return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		if (context.currentString.startsWith("event-values: ")) {
			this.eventValues = context.currentString.split(", ");
		}
		else if (context.currentString.startsWith("pattern: ")) {
			context.currentSkriptFile?.workSpace.effectPatterns.addPattern(context.push("pattern: ".length), this);
		}
		else{
			context.addDiagnostic(0, context.currentString.length, "can't understand this line");
		}
	}
	override addPattern(context: SkriptContext): void {
		context.currentSkriptFile?.workSpace.eventPatterns.addPattern(context, this);
	}
}