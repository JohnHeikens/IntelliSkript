import { PatternData } from '../../PatternTree';
import { SkriptContext } from '../SkriptContext';
import { SkriptSection } from './SkriptSection';

export class SkriptEventListenerSection extends SkriptSection {
	
	eventPattern: PatternData;
	constructor(context: SkriptContext, eventPattern: PatternData) {
        super(context, context.currentSkriptFile);
		this.eventPattern = eventPattern;
	}
}