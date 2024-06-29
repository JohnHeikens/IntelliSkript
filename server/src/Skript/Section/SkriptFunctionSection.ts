import { DiagnosticSeverity, Location } from 'vscode-languageserver/node';
import { TokenTypes } from '../../TokenTypes';
import { SkriptContext } from '../validation/SkriptContext';
import { SkriptVariable } from '../storage/SkriptVariable';
import {
	SkriptSection
} from "./skriptSection/SkriptSection";
import { SkriptFile } from './SkriptFile';
import { PatternData } from '../../pattern/data/PatternData';
import { PatternType } from '../../pattern/PatternType';
import { SkriptTypeState } from '../storage/SkriptTypeState';
export class SkriptFunction extends SkriptSection {
	name: string;
	pattern: PatternData | undefined;
	//context.currentString should be 'function example(a: string, b: number) :: string' for example
	constructor(parent: SkriptSection, context: SkriptContext) {
		super(parent, context);
		const regex = /^function ([a-zA-Z0-9_]{1,})\((.*)\)(| (?:::| returns ) (.*?))$/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		//(,|and|)){1,}\)
		const result = regex.exec(context.currentString);
		if (result == null) {
			context.addDiagnostic(0, context.currentString.length, "cannot recognize function", DiagnosticSeverity.Error, "IntelliSkript->Function->Unrecognized");
			this.name = "";
		}
		else {
			const argumentTypes: SkriptTypeState[] = [];
			const argumentPositions: Location[] = [];
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
						const noSpaceResult = /(?! )/.exec(variableDefinitionParts[1]);
						if (noSpaceResult) {
							const typeStartPosition = currentArgumentString.index + variableDefinitionParts[0].length + ":".length + noSpaceResult.index;
							const initialType = this.parseTypes(specializedContext, typeStartPosition, typeStartPosition + variableDefinitionParts[1].length);
							/**where the arguments are located */
							const loc = specializedContext.getLocation(currentArgumentString.index, variableDefinitionParts[0].trim().length);
							if (initialType) {
								argumentTypes.push(initialType);
								argumentPositions.push(loc);
							}
							this.definedVariables.push(new SkriptVariable(loc, variableName, true));
							specializedContext.addToken(TokenTypes.parameter, currentArgumentString.index, variableDefinitionParts[0].trim().length);
						}
					}
					else {
						specializedContext.addDiagnostic(currentArgumentString.index, currentArgumentString.text.length, "unrecognized function argument (no \":\" found)");
					}
				}
			}
			let argumentPatternString = argumentTypes.length ? '%' + ',[ ]%'.repeat(argumentTypes.length - 1) : '';
			this.pattern = new PatternData(
				this.name + '[(]' + argumentPatternString + '[)]',
				this.name + '(\()?' + argumentPatternString + '(\))?', context.getLocation(), PatternType.effect, undefined, argumentTypes, argumentPositions);

			(parent as SkriptFile).addPattern(this.pattern)
		}
	}
}
