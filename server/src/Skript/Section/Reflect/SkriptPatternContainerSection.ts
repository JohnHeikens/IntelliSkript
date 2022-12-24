import { TokenTypes } from '../../../TokenTypes';
import { PatternType } from "../../../Pattern/PatternType";
import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection';
import { SkriptPatternSection } from './SkriptPatternSection';
import { PatternTree } from '../../../Pattern/PatternTree';
import assert = require('assert');

const patternRegEx = /^pattern(|s)$/;
export class SkriptPatternContainerSection extends SkriptSection {
	addPattern(context: SkriptContext): void {
		assert(context.currentSkriptFile != undefined);
		const pattern = PatternTree.parsePattern(context, this, PatternType.effect);
		if (pattern) {
			context.currentSkriptFile.addPattern(pattern);
		}
	}

	createSection(context: SkriptContext): SkriptSection {
		const result = patternRegEx.exec(context.currentString);
		if (result) {
			context.addToken(TokenTypes.keyword, 0, context.currentString.length);
			return new SkriptPatternSection(context, this);
		}
		else {
			//context.addDiagnostic(0, context.currentString.length, "unknown section", DiagnosticSeverity.Error, "IntelliSkript->Section->Unknown");
			return super.createSection(context);
		}
	}
	processLine(context: SkriptContext): void {
		if(patternRegEx.test(context.currentString)) {
			const spaceIndex = context.currentString.indexOf(' ');
			context.addToken(TokenTypes.keyword, 0, spaceIndex);
			this.addPattern(context.push(spaceIndex + 1));
		}
	}
}
