import { PatternData } from '../../Pattern/Data/PatternData';
import { SkriptContext } from '../SkriptContext';
import { SkriptSection } from './SkriptSection/SkriptSection';
import { SkriptSectionGroup } from './SkriptSectionGroup';
import { SkriptTypeSection } from './IntelliSkript/SkriptTypeSection';

export class SkriptLoopSection extends SkriptSection {
	loopType: SkriptTypeSection | undefined;
	constructor(context: SkriptContext, parent?: SkriptSectionGroup) {
		super(context, parent);
		const loopValueContext = context.push("loop ".length);
		loopValueContext.createHierarchy(true);
		if (loopValueContext.hierarchy)
		{
			const result = this.detectPatternsRecursively(loopValueContext, loopValueContext.hierarchy);
			if (result[0]?.section)
            {
				this.loopType = result[0].section as SkriptTypeSection;
				return;
			}
		}
	}
	
}