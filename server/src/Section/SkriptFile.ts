import {
	SkriptSection
} from "./SkriptSection";

import { SkriptFunction } from './SkriptFunction';

import {
	SkriptContext
} from '../SkriptContext';
import { SkriptCommand } from './SkriptCommand';
import { SkriptEffect } from './SkriptEffect';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SkriptWorkSpace } from './SkriptWorkSpace';
import { SkriptImportSection } from './SkriptImportSection';
import { DiagnosticSeverity } from 'vscode-languageserver/node';

function removeRemainder(toDivide: number, toDivideBy: number): number {
	return Math.floor(toDivide / toDivideBy) * toDivideBy;
}

export class SkriptFile extends SkriptSection {
	document: TextDocument;
	workSpace: SkriptWorkSpace | undefined;

	createSection(context: SkriptContext): SkriptSection {
		const spaceIndex = context.currentString.indexOf(" ");
		const sectionKeyword = spaceIndex == -1 ? context.currentString : context.currentString.substring(0, spaceIndex);
		if (sectionKeyword == "function") {
			const s = new SkriptFunction(context, this);

			return s;
		}
		else if (sectionKeyword == "command") {
			const c = new SkriptCommand(context, this);
			return c;
		}
		else if (sectionKeyword == "effect") {
			const s = new SkriptEffect(context, this);
			return s;
		}
		else if (sectionKeyword == "import") {
			const s = new SkriptImportSection(context, this);
			return s;
		}
		else {
			return super.createSection(context);
		}
	}

	processLine(context: SkriptContext): void {
		context.addDiagnostic(0, context.currentString.length, "can't understand this line (colon or indentation missing?");
	}

	static getIndentationEndIndex(line: string): number {
		return line.search(/(?!( |\t))/);
	}



	constructor(workSpace: SkriptWorkSpace | undefined, context: SkriptContext) {
		super(context, undefined);
		this.workSpace = workSpace;
		this.document = context.currentDocument;
		context.currentSection = this;

		const text = context.currentDocument.getText();

		const lines = text.split("\n");

		const currentSections: SkriptSection[] = [];
		currentSections[0] = this;

		let currentLineIndex = 0;
		let currentLineStartPosition = 0;

		let expectedIndentationCount = 0;
		let currentIndentationString = "";

		function popStacks(stacksToPop: number) {
			if (context.currentSection != undefined) {
				for (let i = 0; i < stacksToPop; i++) {
					context.currentSection.endLine = currentLineIndex;
					context.currentSection = context.currentSection?.parent instanceof SkriptSection ? context.currentSection?.parent as SkriptSection : undefined;
					if (!context.currentSection) {
						break;
					}
				}
			}
		}

		while (currentLineIndex < lines.length) {
			const currentLine = lines[currentLineIndex];
			//const currentLineContext = context.push(currentLineStartPosition, currentLine.length);

			//remove comments and space from the right
			const commentIndex = currentLine.search(/(?<!#)#(?!#)/);
			const lineWithoutComments = commentIndex == -1 ? currentLine : currentLine.substring(0, commentIndex);
			const trimmedLine = lineWithoutComments.trim();

			//cont:
			if (trimmedLine.length > 0) {
				const indentationEndIndex = SkriptFile.getIndentationEndIndex(currentLine);
				//context.currentPosition = currentLineStartPosition + indentationEndIndex;
				const indentationString = currentLine.substring(0, indentationEndIndex);
				const inverseIndentationType = (indentationString[0] == " ") ? "\t" : " ";
				const currentExpectedIndentationcharacterCount = expectedIndentationCount * currentIndentationString.length;
				if (indentationString.includes(inverseIndentationType)) {
					context.addDiagnostic(
						currentLineStartPosition,
						currentLineStartPosition + indentationEndIndex,
						`indentation error: do not mix tabs and spaces` + indentationEndIndex,
						DiagnosticSeverity.Error,
						"IntelliSkript->Indent->Mix",
						currentIndentationString.repeat(expectedIndentationCount)
					);
				}
				else {
					if (currentIndentationString == "") {
						currentIndentationString = indentationString;
						if(indentationString == "")
						{
							popStacks(expectedIndentationCount);
							expectedIndentationCount = 0;
						}
					}
					else {
						if ((indentationEndIndex > currentExpectedIndentationcharacterCount) || (indentationEndIndex % currentIndentationString.length) != 0) {
							const difference = indentationEndIndex - removeRemainder(indentationEndIndex, currentIndentationString.length);
							context.addDiagnostic(
								currentLineStartPosition + removeRemainder(indentationEndIndex, currentIndentationString.length),
								difference,
								`indentation error: expected ` + currentExpectedIndentationcharacterCount + (currentIndentationString[0] == " " ? " space" : " tab") + (currentExpectedIndentationcharacterCount == 1 ? "" : "s") + ` but found ` + indentationEndIndex,
								DiagnosticSeverity.Error,
								"IntelliSkript->Indent->Amount",
								currentIndentationString.repeat(expectedIndentationCount)
							);
							//process the line like normally. this way the next lines will not all generate errors messages.
							//break cont;
						}
						else {
							const currentIndentationCount = indentationEndIndex / currentIndentationString.length;
							const StacksToPop = expectedIndentationCount - currentIndentationCount;
							popStacks(StacksToPop);
							expectedIndentationCount = currentIndentationCount;
						}
					}
					const trimmedContext = context.push(currentLineStartPosition + indentationEndIndex, trimmedLine.length);
					if (trimmedLine.endsWith(":")) {

						const contextWithoutColon = trimmedContext.push(0, trimmedContext.currentString.length - 1);
						//context.currentString = trimmedLine.substring(0, trimmedLine.length - 1);
						contextWithoutColon.createHierarchy(true);
						const newSection: SkriptSection | undefined = context.currentSection?.createSection?.(contextWithoutColon);
						if (newSection != undefined) context.currentSection?.childSections.push(newSection);
						context.currentSection = newSection;
						if (indentationEndIndex == 0) {
							currentIndentationString = "";
						}
						expectedIndentationCount++;
					}
					else {
						//context.currentString = trimmedLine;
						trimmedContext.createHierarchy(true);
						trimmedContext.currentSection?.processLine?.(trimmedContext);
					}
				}
			}
			currentLineIndex++;
			currentLineStartPosition += currentLine.length + 1;
		}
		popStacks(expectedIndentationCount);

		while (currentLineIndex < lines.length) {

			currentLineIndex++;
		}
	}
}