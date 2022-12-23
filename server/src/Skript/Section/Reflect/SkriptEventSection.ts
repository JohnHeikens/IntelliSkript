import { PatternData } from "../../../Pattern/PatternData";
import { PatternType } from "../../../Pattern/PatternType";
import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection';
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';
import { PatternTree } from '../../../Pattern/PatternTree';
import assert = require('assert');
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
				const types = context.parseTypes(valueStrings[i]);
				if (types) {
					this.eventValues[i] = new PatternData("[the] [event( |-)]]" + valueStrings[i], "(the )?(event( |-))?" + valueStrings[i], context.getLocation(currentPosition, valueStrings[i].length), [types], PatternType.effect, this);
				}
				else{
					this.eventValues.splice(i, 1);
				}
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
		assert(context.currentSkriptFile != undefined);
		const pattern = PatternTree.parsePattern(context, this, PatternType.event);
		if (pattern) {
			context.currentSkriptFile.addPattern(pattern);
		}
	}
}