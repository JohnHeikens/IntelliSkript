import { PatternData } from "../../../pattern/data/PatternData";
import { PatternType } from "../../../pattern/PatternType";
import { SkriptContext } from '../../validation/SkriptContext';
import { SkriptSection } from '../skriptSection/SkriptSection';
import { ReflectPatternContainerSection } from './ReflectPatternContainerSection';
import { SkriptTypeState } from '../../storage/type/SkriptTypeState';
import { TokenTypes } from '../../../TokenTypes';

export class ReflectEventSection extends ReflectPatternContainerSection {
	eventValues: PatternData[] = [];
	static override patternType: PatternType = PatternType.event;

	createSection(context: SkriptContext): SkriptSection | undefined {
		if (context.currentString == "check")
			return new SkriptSection(this, context);

		return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		if (context.currentString.startsWith("event-values: ")) {
			let currentPosition = "event-values: ".length;
			context.addToken(TokenTypes.keyword, 0, "event-values: ".length);
			const valueStrings = context.currentString.substring(currentPosition).split(", ");
			//const unknownType = this.getTypeData("unknown");
			for (let i = 0; i < valueStrings.length; i++) {
				const eventValueType = this.parseType(context, currentPosition, valueStrings[i].length);
				if (eventValueType) {
					this.eventValues.push(new PatternData("[the] [event( |-)]]" + valueStrings[i], "(the )?(event( |-))?" + valueStrings[i], context.getLocation(currentPosition, valueStrings[i].length), PatternType.expression, this, [], [], new SkriptTypeState(eventValueType)));
				}
				currentPosition += valueStrings[i].length + ", ".length;
			}
		}
		else {
			return super.processLine(context);
		}
	}
}