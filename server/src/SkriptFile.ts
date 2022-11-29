import {
	SkriptSection
} from "./SkriptSection";

import { SkriptFunction } from './SkriptFunction';

import {
	SkriptContext
} from './SkriptContext';
import { SkriptCommand } from './SkriptCommand';
import { SkriptEffect } from './SkriptEffect';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SkriptWorkSpace } from './SkriptWorkSpace';
export class SkriptFile extends SkriptSection {
	document: TextDocument;
	workSpace: SkriptWorkSpace | undefined;

	createSection(context: SkriptContext): SkriptSection {
		const sectionKeyword = context.currentString.substring(0, context.currentString.indexOf(" "));
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
		else{
			return super.createSection(context);
		}
	}

	processLine(context: SkriptContext): void {
		context.addDiagnostic(context.currentPosition, context.currentString.length, "can't understand this line (colon or indentation missing?");
	}

	static getIndentationEndIndex(line: string): number {
		return line.search(/(?!( |\t))/);
	}


	constructor(workSpace: SkriptWorkSpace | undefined, context: SkriptContext) {
		super(context,undefined);
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

		while (currentLineIndex < lines.length) {
			const currentLine = lines[currentLineIndex];

			//remove comments and space from the right
			const commentIndex = currentLine.search(/(?<!#)#(?!#)/);
			const lineWithoutComments = commentIndex == -1? currentLine: currentLine.substring(0, commentIndex);
			const trimmedLine = lineWithoutComments.trim();
			
			cont:
			if (trimmedLine.length > 0) {
				const indentationEndIndex = SkriptFile.getIndentationEndIndex(currentLine);
				context.currentPosition = currentLineStartPosition + indentationEndIndex;
				const indentationString = currentLine.substring(0, indentationEndIndex);
				const inverseIndentationType = (indentationString[0] == " ") ? "\t" : " ";
				if (indentationString.includes(inverseIndentationType)) {
					context.addDiagnostic(
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
							context.addDiagnostic(
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
								context.currentSection = context.currentSection?.parent instanceof SkriptSection ? context.currentSection?.parent as SkriptSection : undefined;
							}
							expectedIndentationCount = currentIndentationCount;
						}
					}
					if (trimmedLine.endsWith(":")) {
						context.currentString = trimmedLine.substring(0, trimmedLine.length - 1);
						const newSection: SkriptSection | undefined = context.currentSection?.createSection?.(context);
						if(newSection != undefined) context.currentSection?.childSections.push(newSection);
						context.currentSection = newSection;
						if (indentationEndIndex == 0)
						{
							currentIndentationString = "";
						}
						expectedIndentationCount++;
					}
					else {
						context.currentString = trimmedLine;
						context.currentSection?.processLine?.(context);
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