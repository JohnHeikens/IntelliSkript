import { SkriptSection } from "./SkriptSection/SkriptSection";
import { SkriptFunction } from './SkriptFunctionSection';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { PatternData } from '../../Pattern/Data/PatternData';
import { PatternResultProcessor, stopAtFirstResultProcessor } from '../../Pattern/patternResultProcessor';
import { PatternType } from "../../Pattern/PatternType";
import { SkriptPatternCall } from '../../Pattern/SkriptPattern';
import { TokenTypes } from '../../TokenTypes';
import { PatternTreeContainer } from '../PatternTreeContainer';
import { SkriptContext } from '../SkriptContext';
import { SkriptOption } from '../SkriptOption';
import { SkriptPatternMatchHierarchy } from '../SkriptPatternMatchHierarchy';
import { SkriptFolder } from '../WorkSpace/SkriptFolder';
import { SkriptWorkSpace } from '../WorkSpace/SkriptWorkSpace';
import { SkriptTypeSection } from './IntelliSkript/SkriptTypeSection';
import { SkriptConditionProcessorSection } from './Reflect/SkriptConditionProcessorSection';
import { SkriptEffect as SkriptEffectSection } from './Reflect/SkriptEffectSection';
import { SkriptEventSection } from './Reflect/SkriptEventSection';
import { SkriptExpressionSection } from './Reflect/SkriptExpressionSection';
import { SkriptImportSection } from './Reflect/SkriptImportSection';
import { SkriptPatternContainerSection } from './Reflect/SkriptPatternContainerSection';
import { SkriptPropertySection } from './Reflect/SkriptPropertySection';
import { SkriptCommandSection } from './SkriptCommand';
import { SkriptEventListenerSection } from './SkriptEventListenerSection';
import { SkriptOptionsSection } from './SkriptOptionsSection';
import { UnOrderedSemanticTokensBuilder } from './UnOrderedSemanticTokensBuilder';

function removeRemainder(toDivide: number, toDivideBy: number): number {
	return Math.floor(toDivide / toDivideBy) * toDivideBy;
}

export class SkriptFile extends SkriptSection {
	document: TextDocument;
	text: string = "";
	//workSpace: SkriptWorkSpace;
	override parent: SkriptFolder | SkriptWorkSpace;
	builder: UnOrderedSemanticTokensBuilder;

	options: SkriptOption[] = [];

	patterns: PatternTreeContainer = new PatternTreeContainer();
	matches: SkriptPatternMatchHierarchy = new SkriptPatternMatchHierarchy();
	dependents: SkriptFile[] = new Array<SkriptFile>();
	dependencies: SkriptFile[] = new Array<SkriptFile>();
	validated = false;
	diagnostics : Diagnostic[] = [];
	/**
	 * invalidate this file, and invalidate its dependents recursively
	 */
	invalidate() {
		//first see what dependencies and dependents this file had.
		for (const dependency of this.dependencies) {
			//remove the old file from the dependencies' dependents
			dependency.dependents.splice(dependency.dependents.indexOf(this, 0), 1);
		}
		this.dependencies = new Array<SkriptFile>();

		if (this.validated) {
			//first set outdated to true, to avoid an infinite loop caused by circular dependencies
			this.validated = false;
			//all the dependents of this file, their dependents, and so on need to be updated recursively
			for (const dependent of this.dependents) {
				dependent.invalidate();
			}
			this.dependents = new Array<SkriptFile>();
		}
	}
	updateContent(newDocument : TextDocument){
		const newText = newDocument.getText();
		if(newText != this.text){
			this.document = newDocument;
			this.text = newText;
			this.invalidate();
		}
	}

	override getPatternData(testPattern: SkriptPatternCall, shouldContinue: PatternResultProcessor): PatternData | undefined {
		//the file doesn't store patterns, patterns are stored in the workspace, so it will look in the workspace for patterns.
		//when a pattern is found outside of the current file, it'll add a dependency.

		const result = this.parent?.getPatternData(testPattern, shouldContinue);
		if (result) {
			if (result.definitionLocation.uri != this.document.uri) {
				let f : SkriptSection | undefined = result.section;
				while (f && !(f instanceof SkriptFile) && f.parent instanceof SkriptSection){
					f = f.parent;
				}
				if (f && f instanceof SkriptFile) {//for the debugger
					if (f.dependents.find(value => value.document.uri == this.document.uri) == undefined) {
						f.dependents.push(this);
					}
					if (this.dependencies.find(value => value.document.uri == (f as SkriptFile).document.uri) == undefined) {
						this.dependencies.push(f);
					}

				}
			}
		}
		return result;
	}


	addPattern(pattern: PatternData): void {
		this.patterns.addPattern(pattern);
		if (this.parent instanceof SkriptFolder)
			this.parent.patterns.addPattern(pattern);
	}

	createSection(context: SkriptContext): SkriptSection {
		const spaceIndex = context.currentString.indexOf(" ");
		let patternStartIndex = spaceIndex == -1 ? undefined : spaceIndex + 1;
		const sectionKeyword = spaceIndex == -1 ? context.currentString : context.currentString.substring(0, spaceIndex);
		context.addToken(TokenTypes.keyword, 0, sectionKeyword.length);
		let s: SkriptSection | undefined;
		if (sectionKeyword == "function") {
			s = new SkriptFunction(context, this);

		}
		else if (sectionKeyword == "command") {
			s = new SkriptCommandSection(context, this);
		}
		else if (sectionKeyword == "import") {
			s = new SkriptImportSection(context, this);
		}
		else if (sectionKeyword == "event") {
			s = new SkriptEventSection(context, this);
		}
		else if (sectionKeyword == "condition") {
			s = new SkriptConditionProcessorSection(context, this);
		}
		else if (sectionKeyword == "effect") {
			s = new SkriptEffectSection(context, this);
		}
		else if (sectionKeyword == "options") {
			s = new SkriptOptionsSection(context, this);
		}
		else if (sectionKeyword == "type") {
			s = new SkriptTypeSection(context, this);
		}
		else {
			const result = /^((local )?((plural|non-single) )?expression)( .*|)/.exec(context.currentString);
			if (result) {
				s = new SkriptExpressionSection(context, this);
				if (result[5]) {
					patternStartIndex = result[1].length + " ".length;
				}
				else {
					patternStartIndex = undefined;
				}
			}
			else {
				const propertyResult = /^(((local )?((plural|non-single) )?)(.+) property) .*/.exec(context.currentString);
				if (propertyResult) {
					const typeStart = propertyResult[2].length;
					const typeEnd = typeStart + propertyResult[6].length;
					const data = this.parseType(context, typeStart, typeEnd);
					if (data) {
						s = new SkriptPropertySection(context, data, this);
						patternStartIndex = propertyResult[2].length + " ".length;
					}
					//else {
					//	context.addDiagnostic(0, context.currentString.length, "property type not recognized");
					//}
				}
				else {
					const pattern = this.getPatternData(new SkriptPatternCall(context.currentString, PatternType.event), stopAtFirstResultProcessor);
					if (pattern) {
						//event
						s = new SkriptEventListenerSection(context, pattern);
					}
				}
			}
		}
		if ((patternStartIndex != undefined) && (s instanceof SkriptPatternContainerSection)) {
			s.addPattern(context.push(patternStartIndex));
			//const currentPatternType = (
			//	(s instanceof SkriptEventSection) ? PatternType.event :  
			//	(s instanceof SkriptTypeSection) ? PatternType.type :
			//	PatternType.effect);
			//this.addPattern(context.push(patternStartIndex), s, currentPatternType);
		}
		return s ? s : super.createSection(context);
	}

	processLine(context: SkriptContext): void {
		context.addDiagnostic(0, context.currentString.length, "can't understand this line (colon or indentation missing?");
	}

	static getIndentationEndIndex(line: string): number {
		return line.search(/(?!( |\t))/);
	}
	validate() {
		//clear old data
		this.patterns = new PatternTreeContainer();
		this.matches = new SkriptPatternMatchHierarchy();
		this.options = [];
		this.diagnostics = [];
		//dependencies are handled by the workspace
		const context = new SkriptContext(this);
		context.currentSection = this;
		this.builder.startNextBuild(this.document);

		const lines = this.text.split("\n");

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

			if (trimmedLine.length > 0) {
				//process indentation
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
				//removed indentation and comments
				const trimmedContext = currentLineContext.push(indentationEndIndex, trimmedLine.length);

				if (trimmedLine.endsWith(":")) {
					//indent
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
					trimmedContext.currentSection?.processLine?.(trimmedContext);
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
		//the file is updated! set outdated to false
		this.validated = true;
	}

	constructor(parent: SkriptFolder | SkriptWorkSpace, document : TextDocument) {
		super(undefined, parent);
		this.document = document;
		this.text = document.getText();
		this.builder = new UnOrderedSemanticTokensBuilder(this.document);
		this.parent = parent;
	}
	toString(): string {
		const uri = this.document.uri;
		//uri will always have the same \ method, no matter what platform the coder is on
		return uri.substring(uri.lastIndexOf("/"));
	}
}