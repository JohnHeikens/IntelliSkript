import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { TokenTypes } from '../../TokenTypes';
import { SkriptContext } from '../SkriptContext';
import { SkriptVariable } from '../SkriptVariable';
import {
	SkriptSection
} from "./SkriptSection";
export class SkriptFunction extends SkriptSection {
	name: string;
	//context.currentString should be 'function example(a: string, b: number) :: string' for example
	constructor(context: SkriptContext, parent: SkriptSection) {
		super(context, parent);
		const regex = /^function ([a-zA-Z1-9_]{1,})\((.*)\)(| :: (.*?))$/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		//(,|and|)){1,}\)
		const result = regex.exec(context.currentString);
		if (result == null) {
			context.addDiagnostic(0, context.currentString.length, "cannot recognize function", DiagnosticSeverity.Error, "IntelliSkript->Function->Unrecognized");
			this.name = "";
		}
		else {
			this.name = result[1];
			if (result[2].trim().length > 0) {
				const argumentIndex = "function ".length + result[1].length + "(".length;
				const specializedContext = context.push(argumentIndex, result[2].length);
				specializedContext.createHierarchy();
				const argumentStrings = specializedContext.splitHierarchically(/,/g); //result[2].split(/,|and/);
				for (const currentArgumentString of argumentStrings) {
					const variableDefinitionParts = currentArgumentString.text.split(":");
					if (variableDefinitionParts.length == 2) {
						const variableName = "_" + variableDefinitionParts[0].trim();
						const loc = specializedContext.getLocation(currentArgumentString.index, variableDefinitionParts[0].trim().length);
						this.definedVariables.push(new SkriptVariable(loc, variableName, variableDefinitionParts[1].trim(), true));
						specializedContext.addToken(TokenTypes.parameter, currentArgumentString.index, variableDefinitionParts[0].trim().length);
					}
					else {
						specializedContext.addDiagnostic(currentArgumentString.index, currentArgumentString.text.length, "unrecognized function argument (no \":\" found)");
					}
				}
			}
		}
	}
}