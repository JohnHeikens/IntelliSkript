import { SkriptContext } from '../../SkriptContext';
import { SkriptPatternSection } from './SkriptPatternSection';
import { SkriptSection } from '../SkriptSection';
import { TokenTypes } from '../../../TokenTypes';
import { PatternType } from '../../PatternTreeContainer';

export class SkriptPatternContainerSection extends SkriptSection {
	addPattern(context: SkriptContext): void {
		context.currentSkriptFile.addPattern(context, this, PatternType.effect);
	}

	createSection(context: SkriptContext): SkriptSection {
		const regex = /^pattern(|s)$/;
		const result = regex.exec(context.currentString);
		if (result) {
			context.addToken(TokenTypes.keyword, 0, context.currentString.length);
			return new SkriptPatternSection(context, this);
		}
		else {
			//context.addDiagnostic(0, context.currentString.length, "unknown section", DiagnosticSeverity.Error, "IntelliSkript->Section->Unknown");
			return super.createSection(context);
		}
	}

}