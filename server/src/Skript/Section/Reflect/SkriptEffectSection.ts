import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { TokenTypes } from '../../../TokenTypes';
import type { SkriptContext } from '../../validation/SkriptContext';
import {
	SkriptSection
} from "../skriptSection/SkriptSection";
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';
import { PatternType } from '../../../pattern/PatternType';

export class SkriptEffect extends SkriptPatternContainerSection {
	static patternType = PatternType.effect;
	createSection(context: SkriptContext): SkriptSection | undefined {
		const regex = /^(parse|trigger)$/;
		const result = regex.exec(context.currentString);

		if (result) {
			context.addToken(TokenTypes.keyword, 0, context.currentString.length);
			return new SkriptSection(this, context);
		}
		else return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		context.addDiagnostic(0, context.currentString.length, "make sure to put your code for the effect in triggers", DiagnosticSeverity.Error, "IntelliSkript->Section->Wrong");
	}

}