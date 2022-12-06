import { SkriptContext } from '../../SkriptContext';
import { SkriptPatternSection } from './SkriptPatternSection';
import { SkriptSection } from '../SkriptSection';
import { SkriptPattern } from '../../SkriptPattern';

export class SkriptPatternContainerSection extends SkriptSection {
	patterns: SkriptPattern[] = [];
	createSection(context: SkriptContext): SkriptSection {
		const regex = /^pattern(|s)$/;
		const result = regex.exec(context.currentString);
		if (result) {
			return new SkriptPatternSection(context, this);
		}
		else {
			//context.addDiagnostic(0, context.currentString.length, "unknown section", DiagnosticSeverity.Error, "IntelliSkript->Section->Unknown");
			return super.createSection(context);
		}
	}

}