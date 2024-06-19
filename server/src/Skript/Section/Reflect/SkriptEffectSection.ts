import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { TokenTypes } from '../../../TokenTypes';
import type { SkriptContext } from '../../SkriptContext';
import {
	SkriptSection
} from "../SkriptSection/SkriptSection";
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';
export class SkriptEffect extends SkriptPatternContainerSection {
	createSection(context: SkriptContext): SkriptSection {
		const regex = /^(parse|trigger)$/;
		const result = regex.exec(context.currentString);

		if (result) {
			context.addToken(TokenTypes.keyword, 0, context.currentString.length);
			return new SkriptSection(context, this);
		}
		else return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		context.addDiagnostic(0, context.currentString.length, "make sure to put your code for the effect in triggers", DiagnosticSeverity.Error, "IntelliSkript->Section->Wrong");
	}

}