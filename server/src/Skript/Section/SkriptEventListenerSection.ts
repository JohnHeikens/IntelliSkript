import { PatternData } from "../../pattern/data/PatternData";
import { PatternTreeContainer } from '../../pattern/PatternTreeContainer';
import { SkriptContext } from '../validation/SkriptContext';
import { SkriptEventSection } from './reflect/SkriptEventSection';
import { SkriptSection } from './skriptSection/SkriptSection';

export class SkriptEventListenerSection extends SkriptSection {
	patternContainer: PatternTreeContainer;
	eventPattern: PatternData;
	constructor(context: SkriptContext, eventPattern: PatternData) {
		super(context.currentSkriptFile, context);
		this.eventPattern = eventPattern;
		this.patternContainer = new PatternTreeContainer(context.currentSkriptFile.patternContainer);
		const s = this.eventPattern.section as SkriptEventSection;
		if (s.eventValues)
			for (let i = 0; i < s.eventValues.length; i++) {
				this.patternContainer.addPattern(s.eventValues[i]);
			}
	}
}