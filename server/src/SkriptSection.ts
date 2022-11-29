import {
	SkriptContext
} from './SkriptContext';
import { SkriptVariable } from './SkriptVariable';
import {SkriptSectionGroup } from './SkriptSectionGroup';
import { Location } from 'vscode-languageserver/node';
const variablePattern = /\{(.*)\}/g;

export class SkriptSection extends SkriptSectionGroup {
	definedVariables: Array<SkriptVariable> = [];

	startLine: number;

	constructor(context: SkriptContext, parent: SkriptSection | undefined) {
		super(parent);
		this.startLine = context.currentDocument.positionAt(context.currentPosition).line;
	}

	override getVariableByName(name: string) : SkriptVariable | undefined
	{
		for(const variable of this.definedVariables) {
			if (variable.overlap(name))//regexes overlap, could be the same variable
			{
				return variable;
			}
		}
		if (this.parent != undefined) {
			return this.parent.getVariableByName(name);
		}
		return undefined;
	}

	addVariableReference(referenceLocation: Location, name: string): void{
		const existingVariable = this.getVariableByName(name);
		if (!existingVariable) {
			this.definedVariables.push(new SkriptVariable(referenceLocation, name, "unknown"));
		}
	}

	processLine(context: SkriptContext): void {

		const checkPattern = /check \[(?!\()(.*?)\]/g;
		let p: RegExpExecArray | null;
		while ((p = checkPattern.exec(context.currentString))) {
			context.addDiagnostic(
				context.currentPosition + p.index + "check [".length,
				p[1].length,
				`add braces around here to increase skript (re)load performance`);
		}
		while ((p = variablePattern.exec(context.currentString))) {
			this.addVariableReference(Location.create(context.currentDocument.uri, 
				{ 
					start: context.currentDocument.positionAt(context.currentPosition + p.index), 
					end: context.currentDocument.positionAt(context.currentPosition + p.index + p[0].length)
				}), p[1]);
		}
		
	}
	createSection(context: SkriptContext): SkriptSection {
		return new SkriptSection(context, this);
	}
	getExactSectionAtLine(line: number): SkriptSection
	{
		const childSection = this.getChildSectionAtLine(line);
		return childSection == undefined? this : childSection.getExactSectionAtLine(line);
	}

	
}