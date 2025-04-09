import { TokenModifiers } from '../../../TokenModifiers';
import { TokenTypes } from '../../../TokenTypes';
import { SkriptContext } from '../../validation/SkriptContext';
import { SkriptSection } from '../skriptSection/SkriptSection';

//TODO: add support for options
export class ReflectImportSection extends SkriptSection {
	processLine(context: SkriptContext): void {
		const regex = /^([a-z]{1,}(?:\.([a-zA-Z0-9_]{1,})){1,})(?:|\$([a-zA-Z0-9_]{1,}))(?:| as (.*))$/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);
		if (result == null) {
			context.addDiagnostic(0, context.currentString.length, "is this an import? (for example java.util.UUID fits here)");
		}
		else {
			context.addToken(TokenTypes.namespace, 0, result[1].length, [TokenModifiers.declaration, TokenModifiers.defaultLibrary]);
			if (result[4])
			{
				context.addToken(TokenTypes.keyword, (result[1] + " ").length, "as".length);
				context.addToken(TokenTypes.type, (result[1] + " as ").length, result[4].length, [TokenModifiers.declaration]);
			}
		}
	}

	override createSection(context: SkriptContext): SkriptSection | undefined {
		context.addDiagnostic(0, context.currentString.length, "this is an import section");
		return undefined;
	}
}