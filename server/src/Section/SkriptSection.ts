import {
	SkriptContext
} from '../SkriptContext';
import { SkriptVariable } from '../SkriptVariable';
import { SkriptSectionGroup } from './SkriptSectionGroup';
import { Location, DiagnosticSeverity } from 'vscode-languageserver/node';
//const variablePattern = /\{(.*)\}/g;
//IMPORT BELOW TO AVOID CIRCULAR DEPENDENCIES

export class SkriptSection extends SkriptSectionGroup {
	definedVariables: Array<SkriptVariable> = [];

	startLine: number;
	endLine: number;

	constructor(context: SkriptContext, parent: SkriptSection | undefined) {
		super(parent);
		this.startLine = context.currentDocument.positionAt(context.currentPosition).line;
		this.endLine = this.startLine;
	}

	//go up first, then iterate downwards
	override getVariableByName(name: string): SkriptVariable | undefined {
		for (const variable of this.definedVariables) {
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

	addVariableReference(referenceLocation: Location, name: string): void {
		const existingVariable = this.getVariableByName(name);
		if (!existingVariable) {
			this.definedVariables.push(new SkriptVariable(referenceLocation, name, "unknown"));
		}
	}

	private detectVariablesRecursively(context: SkriptContext, currentNode: SkriptNestHierarchy) {
		if (currentNode.character == '{') {
			this.addVariableReference(Location.create(context.currentDocument.uri,
				{
					start: context.currentDocument.positionAt(context.currentPosition + currentNode.start + "{".length),
					end: context.currentDocument.positionAt(context.currentPosition + currentNode.end)
				}), context.currentString.substring(currentNode.start + "{".length, currentNode.end));
		}

		for(const currentChild of currentNode.children) {
			this.detectVariablesRecursively(context, currentChild);
		}
	}

	processLine(context: SkriptContext): void {

		let p: RegExpExecArray | null;
		//detect all variables in this line
		if (context.hierarchy) {
			this.detectVariablesRecursively(context, context.hierarchy);
		}
	}
	createSection(context: SkriptContext): SkriptSection {
		const checkPattern = /check \[(?!\()/g;
		let p: RegExpExecArray | null;
		let isIfStatement = false;
		while ((p = checkPattern.exec(context.currentString))) {
			const braceIndex = p.index + "check ".length;
			const node = context.hierarchy?.getChildNodeAt(braceIndex);//without the brace because we need to check the brace
			if (node && node.start == braceIndex) {
				context.addDiagnostic(
					p.index + "check [".length,
					node.end - node.start - 1,
					`add braces around here to increase skript (re)load performance`, DiagnosticSeverity.Information, "IntelliSkript->Performance->Braces->Lambda");
				isIfStatement = true;
			}
		}
		if (context.currentString.startsWith("if")) {
			isIfStatement = true;
		}
		if (isIfStatement) {
			return new SkriptIfStatement(context, this);
		}
		return new SkriptSection(context, this);
	}
	getExactSectionAtLine(line: number): SkriptSection {
		const childSection = this.getChildSectionAtLine(line);
		return childSection == undefined ? this : childSection.getExactSectionAtLine(line);
	}


}
import { SkriptIfStatement } from './SkriptIfStatement'; import { SkriptNestHierarchy } from '../Nesting/SkriptNestHierarchy';
