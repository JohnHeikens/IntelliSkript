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
		else{
			context.addDiagnostic(0, context.currentString.length, "can't understand this line");
		}
	}
}