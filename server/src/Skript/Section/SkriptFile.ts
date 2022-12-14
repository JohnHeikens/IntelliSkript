import {
	SkriptSection
} from "./SkriptSection";

import { SkriptFunction } from './SkriptFunction';

import {
	SkriptContext
} from '../SkriptContext';
import { SkriptCommand } from './SkriptCommand';
import { SkriptEffect } from './Reflect/SkriptEffect';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SkriptWorkSpace } from './SkriptWorkSpace';
import { SkriptImportSection } from './Reflect/SkriptImportSection';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { TokenTypes } from '../../TokenTypes';
import { UnOrderedSemanticTokensBuilder } from './UnOrderedSemanticTokensBuilder';
import { SkriptPatternContainerSection } from './Reflect/SkriptPatternContainerSection';
import { SkriptConditionSection } from './Reflect/SkriptConditionSection';
import assert = require('assert');
import { SkriptEventSection } from './Reflect/SkriptEventSection';
import { SkriptExpressionSection } from './Reflect/SkriptExpressionSection';
import { SkriptOptionsSection } from './SkriptOptionsSection';
import { SkriptOption } from '../SkriptOption';
import { SkriptEventListenerSection } from './SkriptEventListenerSection';
import { SkriptPropertySection } from './Reflect/SkriptPropertySection';
import { SkriptType } from '../SkriptType';
import { PatternTreeContainer, PatternType } from '../PatternTreeContainer';

function removeRemainder(toDivide: number, toDivideBy: number): number {
	return Math.floor(toDivide / toDivideBy) * toDivideBy;
}

export class SkriptFile extends SkriptSection {
	document: TextDocument;
	workSpace: SkriptWorkSpace;
	builder: UnOrderedSemanticTokensBuilder;

	options: SkriptOption[] = [];

	patterns: PatternTreeContainer = new PatternTreeContainer();

	addPattern(context: SkriptContext, patternContainerSection: SkriptPatternContainerSection, type: PatternType): void {
		this.patterns.addPattern(context, patternContainerSection, type);
		this.workSpace.patterns.addPattern(context, patternContainerSection, type);
	}

	createSection(context: SkriptContext): SkriptSection {
		const spaceIndex = context.currentString.indexOf(" ");
		let patternStartIndex = spaceIndex == -1 ? undefined : spaceIndex + 1;
		const sectionKeyword = spaceIndex == -1 ? context.currentString : context.currentString.substring(0, spaceIndex);
		context.addToken(TokenTypes.keyword, 0, sectionKeyword.length);
		let s: SkriptSection;
		if (sectionKeyword == "function") {
			s = new SkriptFunction(context, this);

		}
		else if (sectionKeyword == "command") {
			s = new SkriptCommand(context, this);
		}
		else if (sectionKeyword == "import") {
			s = new SkriptImportSection(context, this);
		}
		else if (sectionKeyword == "event") {
			s = new SkriptEventSection(context, this);
		}
		else if (sectionKeyword == "condition") {
			s = new SkriptConditionSection(context, this);
		}
		else if (sectionKeyword == "effect") {
			s = new SkriptEffect(context, this);
		}
		else if (sectionKeyword == "options") {
			s = new SkriptOptionsSection(context, this);
		}
		else {
			const result = /^((local )?((plural|non-single) )?expression)( .*|)/.exec(context.currentString);
			if (result) {
				s = new SkriptExpressionSection(context, this);
				if (result[4]) {
					patternStartIndex = result[1].length + 1;
				}
				else {
					patternStartIndex = undefined;
				}
			}
			else {
				const propertyResult = /^(local )?(.+) property .*/.exec(context.currentString);
				if (propertyResult) {
					s = new SkriptPropertySection(context, new SkriptType(propertyResult[2].substring(1)), this);
				}
				else {
					const pattern = this.workSpace.getPatternData(context.currentString,
						() => {
							return false;
						}, PatternType.event);
					if (pattern) {
						//event
						s = new SkriptEventListenerSection(context, pattern);
					}
					else {
						return super.createSection(context);
					}
				}
			}
		}
		if ((patternStartIndex != undefined) && (s instanceof SkriptPatternContainerSection)) {
			const currentPatternType = ((s instanceof SkriptEventSection) ? PatternType.event : PatternType.effect);
			this.addPattern(context.push(patternStartIndex), s, currentPatternType);
		}
		return s;
	}

	processLine(context: SkriptContext): void {
		context.addDiagnostic(0, context.currentString.length, "can't understand this line (colon or indentation missing?");
	}

	static getIndentationEndIndex(line: string): number {
		return line.search(/(?!( |\t))/);
	}



	constructor(workSpace: SkriptWorkSpace, context: SkriptContext) {
		super(context, workSpace);
		context.currentSkriptFile = this;
		this.builder = context.currentBuilder;
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

		let lastCodeLine = 0;//the index of the last line which contained code, so no lines with comments

		function popStacks(stacksToPop: number) {
			if (stacksToPop > 0) {
				if (context.currentSection != undefined) {
					if (context.currentSection.startLine == (currentLineIndex - 1)) {
						if (currentLineIndex < lines.length) {
							context.addDiagnostic(currentLineStartPosition, lines[currentLineIndex].length, "empty configuration section (expected something here)", DiagnosticSeverity.Warning, "IntelliSkript->Indent->Empty", currentIndentationString.repeat(expectedIndentationCount));
						}
						else {
							const lastLine = lines[currentLineIndex - 1];
							const LastLineStartPosition = currentLineStartPosition - 1 - lastLine.length;
							context.addDiagnostic(LastLineStartPosition, lines[currentLineIndex - 1].length, "empty configuration section", DiagnosticSeverity.Warning, "IntelliSkript->Indent->Empty");
						}
					}
					for (let i = 0; i < stacksToPop; i++) {
						context.currentSection.endLine = lastCodeLine;// currentLineIndex;
						context.currentSection = context.currentSection?.parent instanceof SkriptSection ? context.currentSection?.parent as SkriptSection : undefined;
						if (!context.currentSection) {
							break;
						}
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

			const currentLineContext = context.push(currentLineStartPosition, currentLine.length);
			currentLineContext.currentLine = currentLineIndex;


			const trimmedLine = lineWithoutComments.trim();

			//cont:
			if (trimmedLine.length > 0) {
				const indentationEndIndex = SkriptFile.getIndentationEndIndex(currentLine);
				//context.currentPosition = currentLineStartPosition + indentationEndIndex;
				const indentationString = currentLine.substring(0, indentationEndIndex);
				const inverseCurrentIndentationCharacter = (indentationString[0] == " ") ? "\t" : " ";
				const currentExpectedIndentationcharacterCount = expectedIndentationCount * currentIndentationString.length;
				if (indentationString.includes(inverseCurrentIndentationCharacter)) {
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
						if (indentationString == "") {
							popStacks(expectedIndentationCount);
							expectedIndentationCount = 0;
						}
					}
					else {
						const inverseExpectedIndentationCharacter = currentIndentationString[0] == " " ? "\t" : " ";
						if (indentationString[0] == inverseExpectedIndentationCharacter) {
							context.addDiagnostic(
								currentLineStartPosition,
								indentationEndIndex,
								`indentation error: expected ` + currentExpectedIndentationcharacterCount + (currentIndentationString[0] == " " ? " space" : " tab") + (currentExpectedIndentationcharacterCount == 1 ? "" : "s") + ` but found ` + indentationEndIndex + (indentationString[0] == " " ? " space" : " tab") + ((indentationString.length == 1) ? "" : "s"),
								DiagnosticSeverity.Error,
								"IntelliSkript->Indent->Charachter",
								currentIndentationString.repeat(expectedIndentationCount)
							);
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
					}
				}
				const trimmedContext = currentLineContext.push(indentationEndIndex, trimmedLine.length);
				trimmedContext.createHierarchy(true);
				assert(trimmedContext.hierarchy != undefined);
				trimmedContext.highLightRecursively(trimmedContext.hierarchy);

				if (trimmedLine.endsWith(":")) {

					const contextWithoutColon = trimmedContext.push(0, trimmedContext.currentString.length - 1);
					//context.currentString = trimmedLine.substring(0, trimmedLine.length - 1);
					//contextWithoutColon.createHierarchy(true);
					const newSection: SkriptSection | undefined = context.currentSection?.createSection?.(contextWithoutColon);
					if (newSection != undefined) context.currentSection?.children.push(newSection);
					context.currentSection = newSection;
					if (indentationEndIndex == 0) {
						currentIndentationString = "";
					}
					expectedIndentationCount++;
				}
				else {
					//context.currentString = trimmedLine;
					trimmedContext.currentSection.processLine?.(trimmedContext);
					//trimmedContext.currentSection.endLine = context.currentLine;
				}
				lastCodeLine = currentLineIndex;
			}
			if (commentIndex != -1) {
				currentLineContext.addToken(TokenTypes.comment, commentIndex, currentLine.length - commentIndex);
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