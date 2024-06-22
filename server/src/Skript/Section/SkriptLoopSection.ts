import { PatternData } from '../../Pattern/Data/PatternData';
import { SkriptContext } from '../SkriptContext';
import { SkriptSection } from './SkriptSection/SkriptSection';
import { SkriptSectionGroup } from './SkriptSectionGroup';
import { SkriptTypeSection } from './IntelliSkript/SkriptTypeSection';

export class SkriptLoopSection extends SkriptSection {
	loopType: SkriptTypeSection | undefined;
	constructor(parent: SkriptSection, context: SkriptContext) {
		super(parent, context);
		//const loopValueContext = context.push("loop ".length);
		const result = this.detectPatternsRecursively(context);
		if (result.possibleResultTypes[0]?.section) {
			this.loopType = result.possibleResultTypes[0].section as SkriptTypeSection;
			return;
		}
	}

}