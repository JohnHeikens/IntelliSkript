import { PatternData } from '../../../PatternTree';
import { PatternType } from '../../PatternTreeContainer';
import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection';
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';
export class SkriptEventSection extends SkriptPatternContainerSection {
	eventValues: PatternData[] | undefined = undefined;


	createSection(context: SkriptContext): SkriptSection {
		const regex = /^(pattern(|s))$/;
		const result = regex.exec(context.currentString);


		if (result == null) {
			context.addDiagnostic(0, context.currentString.length, "cannot recognize this section");
		}
		return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		if (context.currentString.startsWith("event-values: ")) {
			let currentPosition = "event-values: ".length;
			const valueStrings = context.currentString.substring(currentPosition).split(", ");
			this.eventValues = new Array(valueStrings.length);
			for (let i = 0; i < valueStrings.length; i++) {
				//valueStrings.forEach(element => {
				this.eventValues[i] = new PatternData("[the] [event( |-)]]" + valueStrings[i], "(the )?(event( |-))?" + valueStrings[i], context.getLocation(currentPosition, valueStrings[i].length), this);
				currentPosition += valueStrings[i].length + ", ".length;
			}
		}
		else if (context.currentString.startsWith("pattern: ")) {
			context.currentSkriptFile.addPattern(context.push("pattern: ".length), this, PatternType.event);
		}
		else {
			context.addDiagnostic(0, context.currentString.length, "can't understand this line");
		}
	}
	override addPattern(context: SkriptContext): void {
		context.currentSkriptFile.addPattern(context, this, PatternType.event);
	}
}