import assert = require('assert');
import { PatternData } from "../../pattern/data/PatternData";
import { PatternResultProcessor } from "../../pattern/patternResultProcessor";
import { PatternType } from "../../pattern/PatternType";
import { SkriptPatternCall } from '../../pattern/SkriptPattern';
import { SkriptContext } from '../validation/SkriptContext';
import { SkriptEventSection } from './reflect/SkriptEventSection';
import { SkriptSection } from './skriptSection/SkriptSection';
import { MatchResult } from '../../pattern/match/matchResult';
import { PatternTreeContainer } from '../../pattern/PatternTreeContainer';

export class SkriptEventListenerSection extends SkriptSection {
	patternContainer: PatternTreeContainer;
	eventPattern: PatternData;
	constructor(context: SkriptContext, eventPattern: PatternData) {
		super(context.currentSkriptFile, context);
		this.eventPattern = eventPattern;
		this.patternContainer = new PatternTreeContainer(context.currentSkriptFile.patternContainer);
		const s = this.eventPattern.section as SkriptEventSection;
		assert(s.eventValues);
		for (let i = 0; i < s.eventValues.length; i++) {
			this.patternContainer.addPattern(s.eventValues[i]);
		}
	}
}