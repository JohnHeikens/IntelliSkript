import { PatternData } from '../../pattern/data/PatternData';
import { PatternTreeContainer } from '../../pattern/PatternTreeContainer';
import { PatternType } from '../../pattern/PatternType';
import { SkriptTypeState } from '../storage/type/SkriptTypeState';
import { SkriptContext } from '../validation/SkriptContext';
import { SkriptTypeSection } from './custom/SkriptTypeSection';
import { SkriptSection } from './skriptSection/SkriptSection';

export class SkriptLoopSection extends SkriptSection {
	loopType: SkriptTypeSection | undefined;
	constructor(parent: SkriptSection, context: SkriptContext) {
		super(parent, context);
		//const loopValueContext = context.push("loop ".length);
		const pattern = this.detectPatternsRecursively(context, PatternType.expression);
		const result = pattern.detectedPattern?.returnType?.possibleTypes;
		if (result?.length && result[0].section) {
			this.loopType = result[0].section as SkriptTypeSection;
			this.patternContainer = new PatternTreeContainer(parent.getPatternTree());
			this.patternContainer.addPattern(new PatternData("[the] loop-value", "(the )?loop-value", context.getLocation(), PatternType.expression, undefined, [], [], new SkriptTypeState(result[0])));
		}
	}

}