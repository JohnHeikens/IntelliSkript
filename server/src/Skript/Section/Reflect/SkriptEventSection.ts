import { PatternData } from "../../../Pattern/Data/PatternData";
import { PatternType } from "../../../Pattern/PatternType";
import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection/SkriptSection';
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';
import { PatternTree } from '../../../Pattern/PatternTree';
import assert = require('assert');
import { SkriptTypeState } from '../../SkriptTypeState';
export class SkriptEventSection extends SkriptPatternContainerSection {
	eventValues: PatternData[] = [];


	createSection(context: SkriptContext): SkriptSection {
		if (context.currentString == "check")
			return new SkriptSection(context, this);

		return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		if (context.currentString.startsWith("event-values: ")) {
			let currentPosition = "event-values: ".length;
			const valueStrings = context.currentString.substring(currentPosition).split(", ");
			//const unknownType = this.getTypeData("unknown");
			for (let i = 0; i < valueStrings.length; i++) {
				//valueStrings.forEach(element => {
				//const type = context.currentSection?.parseType(context, currentPosition, currentPosition + valueStrings[i].length);
				const eventValueType = this.getTypeData(valueStrings[i]);
				if (eventValueType) {
					this.eventValues.push(new PatternData("[the] [event( |-)]]" + valueStrings[i], "(the )?(event( |-))?" + valueStrings[i], context.getLocation(currentPosition, valueStrings[i].length), PatternType.effect, this, [], [], new SkriptTypeState(eventValueType)));
				}
				//this.eventValues.pu;
				currentPosition += valueStrings[i].length + ", ".length;
			}
		}
		else {
			return super.processLine(context);
		}
		//else if (context.currentString.startsWith("pattern: ")) {
		//	context.currentSkriptFile.addPattern(context.push("pattern: ".length), this, PatternType.event);
		//}
		//else {
		//	context.addDiagnostic(0, context.currentString.length, "can't understand this line");
		//}
	}
	override addPattern(context: SkriptContext): void {
		const pattern = PatternTree.parsePattern(context, this, PatternType.event);
		if (pattern)
			context.currentSkriptFile.addPattern(pattern);
	}
}