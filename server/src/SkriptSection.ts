import {
	SkriptContext
} from './SkriptContext';
import { SkriptVariable } from './SkriptVariable';
import {SkriptSectionGroup } from './SkriptSectionGroup';
import { Location } from 'vscode-languageserver/node';

export class SkriptSection extends SkriptSectionGroup {
	definedVariables: Array<SkriptVariable> = [];

	startLine: number;

	constructor(context: SkriptContext, parent: SkriptSection | undefined) {
		super(parent);
		this.startLine = context.currentDocument.positionAt(context.currentPosition).line;
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
	}
	createSection(context: SkriptContext): SkriptSection {
		return new SkriptSection(context, this);
	}
	getExactSectionAtLine(line: number): SkriptSection
	{
		const childSection = this.getChildSectionAtLine(line);
		return childSection == undefined? this : childSection.getExactSectionAtLine(line);
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
}