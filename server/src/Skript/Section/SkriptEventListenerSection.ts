import assert = require('assert');
import { PatternData } from "../../pattern/data/PatternData";
import { PatternResultProcessor } from "../../pattern/patternResultProcessor";
import { PatternType } from "../../pattern/PatternType";
import { SkriptPatternCall } from '../../pattern/SkriptPattern';
import { SkriptContext } from '../validation/SkriptContext';
import { SkriptEventSection } from './reflect/SkriptEventSection';
import { SkriptSection } from './skriptSection/SkriptSection';
import { MatchArray } from '../../pattern/match/matchArray';

export class SkriptEventListenerSection extends SkriptSection {

	eventPattern: PatternData;
	constructor(context: SkriptContext, eventPattern: PatternData) {
		super(context.currentSkriptFile, context);
		this.eventPattern = eventPattern;
	}
	override getPatternData(testPattern: SkriptPatternCall): PatternData | undefined {
		//if (testPattern.type == PatternType.effect) {
		//	const s = this.eventPattern.section as SkriptEventSection;
		//	assert(s.eventValues);
		//	for (let i = 0; i < s.eventValues.length; i++) {
		//		let result;
		//		if ((result = testPattern.compare(s.eventValues[i])).matches.length) {
		//			return result;
		//		}
		//	}
		//}
		return super.getPatternData(testPattern);
	}
}