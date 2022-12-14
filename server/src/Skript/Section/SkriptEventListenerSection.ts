import { PatternData, patternResultProcessor } from '../../PatternTree';
import { SkriptContext } from '../SkriptContext';
import { SkriptSection } from './SkriptSection';
import { SkriptEventSection } from './Reflect/SkriptEventSection';
import { PatternType } from '../PatternTreeContainer';

export class SkriptEventListenerSection extends SkriptSection {

	eventPattern: PatternData;
	constructor(context: SkriptContext, eventPattern: PatternData) {
		super(context, context.currentSkriptFile);
		this.eventPattern = eventPattern;
	}
	override getPatternData(pattern: string, shouldContinue: patternResultProcessor, type: PatternType): PatternData | undefined {
		if (type == PatternType.effect) {
			const s = this.eventPattern.section as SkriptEventSection;
			for (let i = 0; i < s.eventValues.length; i++) {
				if (s.eventValues[i].patternRegExp.test(pattern)) {
					return s.eventValues[i];
				}
			}
		}
		return super.getPatternData(pattern, shouldContinue, type);
	}
}