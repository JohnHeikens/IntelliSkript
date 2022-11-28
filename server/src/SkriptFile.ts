import {
	SkriptSection
} from "./SkriptSection";

import {
	DiagnosticSeverity,
	Diagnostic
} from 'vscode-languageserver/node';
import { SkriptFunction } from './SkriptFunction';

import {
	SkriptContext
} from './SkriptContext';
export class SkriptFile extends SkriptSection {

	createSection(context: SkriptContext): SkriptSection {
		const sectionKeyword = context.currentString.substring(0, context.currentString.indexOf(" "));
		if (sectionKeyword == "function") {
			const f = new SkriptFunction(context, this);
			
			return f;
		}
		else{
			return super.createSection(context);
		}
	}

	processLine(context: SkriptContext): void {
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: context.currentDocument.positionAt(context.currentPosition),
				end: context.currentDocument.positionAt(context.currentPosition + context.currentString.length)
			},
			message: `can't understand this line (colon or indentation missing?)`,
			source: 'IntelliSkript'
		};
		context.diagnostics.push(diagnostic);
	}

	constructor(currentContext: SkriptContext) {
		super(undefined);
		currentContext.currentSection = this;

		const text = currentContext.currentDocument.getText();

		const lines = text.split("\n");

		const currentSections: SkriptSection[] = [];
		currentSections[0] = this;

		let currentLineIndex = 0;
		let currentLineStartPosition = 0;

		let expectedIndentationCount = 0;
		let currentIndentationString = "";

		while (currentLineIndex < lines.length) {
			const currentLine = lines[currentLineIndex];

			//remove comments and space from the right
			const commentIndex = currentLine.search(/(?<!#)#(?!#)/);
			const lineWithoutComments = commentIndex == -1? currentLine: currentLine.substring(0, commentIndex);
			const trimmedLine = lineWithoutComments.trim();
			
			cont:
			if (trimmedLine.length > 0) {
				const indentationEndIndex = currentLine.search(/(?!( |\t))/);
				currentContext.currentPosition = currentLineStartPosition + indentationEndIndex;
				const indentationString = currentLine.substring(0, indentationEndIndex);
				const inverseIndentationType = (indentationString[0] == " ") ? "\t" : " ";
				if (indentationString.includes(inverseIndentationType)) {
					currentContext.addDiagnostic(
						currentLineStartPosition + Math.floor(indentationEndIndex / 4) * 4,
						currentLineStartPosition + indentationEndIndex,
						`indentation error: do not mix tabs and spaces` + indentationEndIndex
					);
				}
				else {
					if (currentIndentationString == "") {
						currentIndentationString = indentationString;
					}
					else {
						const currentExpectedIndentationCharachterCount = expectedIndentationCount * currentIndentationString.length;
						if ((indentationEndIndex > currentExpectedIndentationCharachterCount) || (indentationEndIndex % currentIndentationString.length) != 0) {
							const difference = indentationEndIndex - (Math.floor(indentationEndIndex / 4) * 4);
							currentContext.addDiagnostic(
								currentLineStartPosition + Math.floor(indentationEndIndex / 4) * 4,
								difference,
								`indentation error: expected ` + currentExpectedIndentationCharachterCount + (currentIndentationString[0] == " " ? " space" : " tab") + (currentExpectedIndentationCharachterCount == 1 ? "" : "s") + ` but found ` + indentationEndIndex
							);
							break cont;
						}
						else{
							const currentIndentationCount = indentationEndIndex / currentIndentationString.length;
							const StacksToPop = expectedIndentationCount - currentIndentationCount;
							for(let i = 0; i < StacksToPop; i++) {
								currentContext.currentSection = currentContext.currentSection?.parent;
							}
							expectedIndentationCount = currentIndentationCount;
						}
					}
					if (trimmedLine.endsWith(":")) {
						currentContext.currentString = trimmedLine.substring(0, currentLine.length - 1);
						const newSection: SkriptSection | undefined = currentContext.currentSection?.createSection?.(currentContext);
						if(newSection != undefined) currentContext.currentSection?.childSections.push(newSection);
						currentContext.currentSection = newSection;
						if (indentationEndIndex == 0)
						{
							currentIndentationString = "";
						}
						expectedIndentationCount++;
					}
					else {
						currentContext.currentString = trimmedLine;
						currentContext.currentSection?.processLine?.(currentContext);
					}
				}
			}
			currentLineIndex++;
			currentLineStartPosition += currentLine.length + 1;
		}

		while (currentLineIndex < lines.length) {

			currentLineIndex++;
		}
	}
}