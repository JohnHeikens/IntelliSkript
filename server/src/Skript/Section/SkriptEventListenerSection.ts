import assert = require('assert');
import { PatternData } from "../../Pattern/PatternData";
import { PatternResultProcessor } from "../../Pattern/patternResultProcessor";
import { PatternType } from "../../Pattern/PatternType";
import { SkriptPatternCall } from '../../Pattern/SkriptPattern';
import { SkriptContext } from '../SkriptContext';
import { SkriptEventSection } from './Reflect/SkriptEventSection';
import { SkriptSection } from './SkriptSection/SkriptSection';

export class SkriptEventListenerSection extends SkriptSection {

	eventPattern: PatternData;
	constructor(context: SkriptContext, eventPattern: PatternData) {
		super(context, context.currentSkriptFile);
		this.eventPattern = eventPattern;
	}
	override getPatternData(testPattern: SkriptPatternCall, shouldContinue: PatternResultProcessor): PatternData | undefined {
		if (testPattern.type == PatternType.effect) {
			const s = this.eventPattern.section as SkriptEventSection;
			assert(s.eventValues);
			for (let i = 0; i < s.eventValues.length; i++) {
				if (s.eventValues[i].patternRegExp.test(testPattern.pattern)) {
					return s.eventValues[i];
				}
			}
		}
		return super.getPatternData(testPattern, shouldContinue);
	}
}