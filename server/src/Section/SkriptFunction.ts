import { Location, Range, DiagnosticSeverity } from 'vscode-languageserver/node';
import { SkriptContext } from '../SkriptContext';
import {
	SkriptSection

} from "./SkriptSection";
import { SkriptVariable } from '../SkriptVariable';
export class SkriptFunction extends SkriptSection {
	name: string;
	//context.currentString should be 'function example(a: string, b: number) :: string' for example
	constructor(context: SkriptContext, parent: SkriptSection) {
		super(context, parent);
		const regex = /function ([a-zA-Z1-9_]{1,})\((.*)\)(| :: (.*))/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		//(,|and|)){1,}\)
		const result = regex.exec(context.currentString);
		if (result == null) {
			context.addDiagnostic(0, context.currentString.length, "cannot recognize function", DiagnosticSeverity.Error, "IntelliSkript->function->unrecognized");
			this.name = "";
		}
		else {
			this.name = result[1];
			if (result[2].trim().length > 0) {
				const argumentStrings = result[2].split(/,|and/);
				for (const currentArgumentString of argumentStrings) {
					const variableDefinitionParts = currentArgumentString.split(":");
					if (variableDefinitionParts.length == 2) {
						const variableName = "_" + variableDefinitionParts[0].trim();
						const currentPosition = context.currentPosition + context.currentString.indexOf(variableDefinitionParts[0].trimEnd());
						const Loc = Location.create(context.currentDocument.uri, Range.create(context.currentDocument.positionAt(currentPosition), context.currentDocument.positionAt(currentPosition + variableDefinitionParts[0].trim().length)));
						this.definedVariables.push(new SkriptVariable(Loc, variableName, variableDefinitionParts[1].trim()));
					}
					else {
						context.addDiagnostic(0 + context.currentString.indexOf(currentArgumentString), currentArgumentString.length, "unrecognized function argument (no \":\" found)");
					}
				}
			}
		}
	}
}