import { PatternData } from '../../pattern/data/PatternData';
import { SkriptContext } from '../validation/SkriptContext';
import { SkriptSection } from './skriptSection/SkriptSection';
import { SkriptSectionGroup } from './SkriptSectionGroup';
import { SkriptTypeSection } from './custom/SkriptTypeSection';

export class SkriptLoopSection extends SkriptSection {
	loopType: SkriptTypeSection | undefined;
	constructor(parent: SkriptSection, context: SkriptContext) {
		super(parent, context);
		//const loopValueContext = context.push("loop ".length);
		const pattern = this.detectPatternsRecursively(context);
		const result = pattern.detectedPattern?.returnType?.possibleTypes;
		if (result?.length && result[0].section) {
			this.loopType = result[0].section as SkriptTypeSection;
			return;
		}
	}

}