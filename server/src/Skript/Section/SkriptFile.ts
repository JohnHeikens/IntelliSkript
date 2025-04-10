import { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticSeverity, Range, TextEdit } from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { PatternData } from '../../pattern/data/PatternData';
import { PatternTreeContainer } from '../../pattern/PatternTreeContainer';
import { PatternType } from "../../pattern/PatternType";
import { SkriptPatternMatchHierarchy } from '../../pattern/SkriptPatternMatchHierarchy';
import { TokenTypes } from '../../TokenTypes';
import { SkriptFolder } from '../folder-container/SkriptFolder';
import { SkriptWorkSpace } from '../folder-container/SkriptWorkSpace';
import { SkriptOption } from '../storage/SkriptOption';
import { IndentData } from '../validation/IndentData';
import { ParseResult } from '../validation/ParseResult';
import { SkriptContext } from '../validation/SkriptContext';
import { SkriptTypeSection } from './custom/SkriptTypeSection';
import { ReflectConditionSection } from './reflect/ReflectConditionSection';
import { ReflectEffectSection as SkriptEffectSection } from './reflect/ReflectEffectSection';
import { ReflectEventSection } from './reflect/ReflectEventSection';
import { ReflectExpressionSection } from './reflect/ReflectExpressionSection';
import { ReflectImportSection } from './reflect/ReflectImportSection';
import { ReflectPatternContainerSection } from './reflect/ReflectPatternContainerSection';
import { ReflectPropertySection } from './reflect/ReflectPropertySection';
import { SkriptCommandSection } from './SkriptCommandSection';
import { SkriptEventListenerSection } from './SkriptEventListenerSection';
import { SkriptFunction } from './SkriptFunctionSection';
import { SkriptOptionsSection } from './SkriptOptionsSection';
import { SkriptSection } from "./skriptSection/SkriptSection";
import { SemanticTokenLine, UnOrderedSemanticTokensBuilder } from './UnOrderedSemanticTokensBuilder';
import { ReflectSectionSection } from './reflect/ReflectSectionSection';
import { SkriptAliasesSection } from './SkriptAliasesSection';



export class SkriptFile extends SkriptSection {
	uri: URI;
	document: TextDocument;
	text: string = "";
	//workSpace: SkriptWorkSpace;
	override parent: SkriptFolder | SkriptWorkSpace;
	builder: UnOrderedSemanticTokensBuilder;

	options: SkriptOption[] = [];
	parseResult: ParseResult = new ParseResult();

	patternContainer: PatternTreeContainer;
	matches: SkriptPatternMatchHierarchy = new SkriptPatternMatchHierarchy();
	//dependents: SkriptFile[] = new Array<SkriptFile>();
	//dependencies: SkriptFile[] = new Array<SkriptFile>();
	validated = false;
	suggestedIndentation: number[] = [];
	/**
	 * invalidate this file, and invalidate it possible dependents
	 */
	invalidate() {
		this.validated = false;
		//first see what dependencies and dependents this file had.
		//for (const dependency of this.dependencies) {
		//	//remove the old file from the dependencies' dependents
		//	dependency.dependents.splice(dependency.dependents.indexOf(this, 0), 1);
		//}
		//this.dependencies = new Array<SkriptFile>();
		//
		//if (this.validated) {
		//	//first set outdated to true, to avoid an infinite loop caused by circular dependencies
		//	this.validated = false;
		//
		//	//for (const dependent of this.dependents) {
		//	//	dependent.invalidate();
		//	//}
		//	this.dependents = new Array<SkriptFile>();
		//}
	}
	/**returns true if the document has changed */
	updateContent(newDocument: TextDocument): boolean {
		const newText = newDocument.getText();
		if (newText != this.text) {
			this.document = newDocument;
			this.text = newText;
			return true;
		}
		return false;
	}

	addPattern(pattern: PatternData): void {
		this.patternContainer.addPattern(pattern);
	}

	createSection(context: SkriptContext): SkriptSection | undefined {
		const spaceIndex = context.currentString.indexOf(" ");
		let patternStartIndex = spaceIndex == -1 ? undefined : spaceIndex + 1;
		const sectionKeyword = spaceIndex == -1 ? context.currentString : context.currentString.substring(0, spaceIndex);
		let addKeywordToken = true;
		let s: SkriptSection | undefined;
		if (sectionKeyword == "function") {
			s = new SkriptFunction(this, context);
		}
		else if (sectionKeyword == "command") {
			s = new SkriptCommandSection(this, context);
		}
		else if (sectionKeyword == "import") {
			s = new ReflectImportSection(this, context);
		}
		else if (sectionKeyword == "event") {
			s = new ReflectEventSection(this, context);
		}
		else if (sectionKeyword == "condition") {
			s = new ReflectConditionSection(this, context);
		}
		else if (sectionKeyword == "section") {
			s = new ReflectSectionSection(this, context);
		}
		else if (sectionKeyword == "effect") {
			s = new SkriptEffectSection(this, context);
		}
		else if (sectionKeyword == "options") {
			s = new SkriptOptionsSection(this, context);
		}
		else if (sectionKeyword == "type") {
			s = new SkriptTypeSection(this, context);
		}
		else if (sectionKeyword == "aliases") {
			s = new SkriptAliasesSection(this, context);
		}
		else {
			const result = /^((local )?((plural|non-single) )?expression)( .*|)/.exec(context.currentString);
			if (result) {
				addKeywordToken = false;
				s = new ReflectExpressionSection(this, context);
				if (result[5]) {
					patternStartIndex = result[1].length + " ".length;
				}
				else {
					patternStartIndex = undefined;
				}
				context.addToken(TokenTypes.keyword, 0, patternStartIndex);
			}
			else {
				const propertyResult = /^(?:((?:(?:local) )?(?:(?:plural|non-single) )?)((?:[^\s]| ){1,}) property) .*/.exec(context.currentString);
				if (propertyResult) {
					const typeStart = propertyResult[1].length;
					const data = this.parseType(context, typeStart, propertyResult[2].length);
					addKeywordToken = false;
					if (data) {
						s = new ReflectPropertySection(this, context, data);
						const typeEnd = typeStart + propertyResult[2].length;
						patternStartIndex = typeEnd + " property ".length;
						//add keyword token for 'local plural'
						context.addToken(TokenTypes.keyword, 0, typeStart);
						//add keyword token for 'property'
						context.addToken(TokenTypes.keyword, typeEnd, " property ".length);
					}
					//else {
					//	context.addDiagnostic(0, context.currentString.length, "property type not recognized");
					//}
				}
				else {
					addKeywordToken = false;
					const result = this.detectPatternsRecursively(context, PatternType.event);
					//const pattern = this.getPatternData(new SkriptPatternCall(context.currentString, PatternType.event), stopAtFirstResultProcessor);
					if (result.detectedPattern) {
						//event
						s = new SkriptEventListenerSection(context, result.detectedPattern);
					}
					else {
						//can't recognise this of section
						context.addDiagnostic(0, context.currentString.length, 'can\'t recognise this section. (pattern detection is a work in progress. please report on discord)', DiagnosticSeverity.Hint, "IntelliSkript->Section->Not Recognised");
					}
				}
			}
		}
		if ((patternStartIndex != undefined) && (s instanceof ReflectPatternContainerSection)) {
			s.addPattern(context.push(patternStartIndex));
			//const currentPatternType = (
			//	(s instanceof SkriptEventSection) ? PatternType.event :
			//	(s instanceof SkriptTypeSection) ? PatternType.type :
			//	PatternType.effect);
			//this.addPattern(context.push(patternStartIndex), s, currentPatternType);
		}
		if (addKeywordToken)
			context.addToken(TokenTypes.keyword, 0, sectionKeyword.length);
		return s;
	}

	processLine(context: SkriptContext): void {
		context.addDiagnostic(0, context.currentString.length, "can't understand this line (colon or indentation missing?");
	}


	static trimLineWithoutComments(line: string): { trimmedLine: string, commentIndex: number } {
		let currentDelimiters = "";
		let commentIndex = -1;
		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			if ('"%'.includes(char)) {
				if (currentDelimiters.length > 0 && currentDelimiters[currentDelimiters.length - 1] == char) {
					currentDelimiters = currentDelimiters.substring(0, currentDelimiters.length - 1);
				} else
					currentDelimiters += line[i];
			}
			else if (char === '#' && currentDelimiters.length == 0){
				commentIndex = i; break;
			}
		}
		//remove comments and space from the right
		//const commentIndex = line.search(
		//	//there can't be a < in front of a # because then it might be a hex color
		//	/(?<![#\<])#(?!#)/
		//);
		const lineWithoutComments = commentIndex == -1 ? line : line.substring(0, commentIndex);
		return { trimmedLine: lineWithoutComments.trim(), commentIndex: commentIndex };
	}
	validate() {
		//clear old data
		this.patternContainer = new PatternTreeContainer(this.parent.getPatternTree());
		this.matches = new SkriptPatternMatchHierarchy();
		//create reference to builder
		this.parseResult = new ParseResult(this.builder);
		this.options = [];
		this.children = [];
		//dependencies are handled by the workspace
		const context = new SkriptContext(this);
		context.currentSection = this;
		this.builder.startNextBuild(this.document);

		/**we need to include the line breaks. to do that, we split using a positive lookbehind.
		to avoid splitting in two separate delimiters when a document has both \r\n, a negative lookahead is added to check for \n
		the last line doesn't have \r\n at the end.*/
		const terminatedLines = this.text.split(/(?<=\r\n|\r(?!\n)|\n)/g);

		this.suggestedIndentation = new Array<number>(terminatedLines.length);

		const currentSections: SkriptSection[] = [];
		currentSections[0] = this;


		let currentLineIndex = 0;
		let currentLineStartPosition = 0;

		let inMultiLineComment = false;

		/**the index of the last line which contained code, so no lines with comments */
		let lastCodeLine = 0;

		const indentData = new IndentData();

		function popStacks(stacksToPop: number) {
			if (stacksToPop > 0) {
				const startLine = context.currentSection.startLine;
				if (startLine == (currentLineIndex - 1)) {
					context.addDiagnosticAbsolute({
						start: { line: startLine, character: 0 },
						end: { line: startLine, character: terminatedLines[startLine].length }
					}, "empty configuration section (expected something here)", DiagnosticSeverity.Warning, "IntelliSkript->Indent->Empty");
				}
				for (let i = 0; i < stacksToPop; i++) {
					const parent = context.currentSection.getParentSection();
					if (parent) {
						context.currentSection.endLine = lastCodeLine;// currentLineIndex;
						context.currentSection.finish(context);
						context.currentSection = parent;
					}
					else break;
				}
			}
		}

		while (currentLineIndex < terminatedLines.length) {
			//the current line, including line break
			const currentLineTerminated = terminatedLines[currentLineIndex];
			const terminatorIndex = currentLineTerminated.search(/[\r\n]/g);
			const currentLine = terminatorIndex == -1 ? currentLineTerminated : currentLineTerminated.substring(0, terminatorIndex);
			const currentLineContext = context.push(currentLineStartPosition, currentLine.length);
			currentLineContext.currentLine = currentLineIndex;

			let wasInMultiLineComment = inMultiLineComment;
			if (currentLine == "###") inMultiLineComment = !inMultiLineComment;
			if (inMultiLineComment || wasInMultiLineComment) {
				currentLineContext.addToken(TokenTypes.comment);
			}
			else {


				const trimInfo = SkriptFile.trimLineWithoutComments(currentLine);

				const trimmedLine = trimInfo.trimmedLine;

				if (trimmedLine.length > 0) {
					indentData.nextLine(currentLineContext);
					indentData.hasColon = trimmedLine.endsWith(":");
					//process indentation
					//context.currentPosition = currentLineStartPosition + indentationEndIndex;
					//removed indentation and comments
					const trimmedContext = currentLineContext.push(indentData.endIndex, trimmedLine.length);

					let newSection: SkriptSection | undefined;
					let mostValidContext: SkriptContext | undefined;

					const checkSection = (section: SkriptSection): boolean => {
						const sectionContext = trimmedContext.push(0,
							indentData.hasColon ? trimmedContext.currentString.length - 1 : undefined);
						sectionContext.currentSection = section;
						sectionContext.parseResult = new ParseResult();
						//first we check the expected section, so the most validcontext will be undefined at this point
						if (!mostValidContext) mostValidContext = sectionContext;

						if (indentData.hasColon) {
							//indent
							newSection = sectionContext.currentSection.createSection?.(sectionContext);
							if (!newSection) return false;
						}
						else {
							//context.currentString = trimmedLine;
							sectionContext.currentSection?.processLine?.(sectionContext);
							//trimmedContext.currentSection.endLine = context.currentLine;
						}
						if (sectionContext.parseResult.diagnostics.length)
							return false;
						mostValidContext = sectionContext;
						return true;
					}

					let expectedSection = trimmedContext.currentSection;

					const expectedStacksToPop = indentData.expected - indentData.mostValid;


					//check different indentation offsets
					//first check the expected indentation, then go back from top to bottom,
					//skipping the expected indentation offset and duplicate types. (duplicate types todo)
					for (let i = 0; i < expectedStacksToPop; i++) {
						const parent = expectedSection.getParentSection();
						if (parent)
							expectedSection = parent;
						else {
							//popping too much stacks

							break;
						}
					}


					if (!checkSection(expectedSection)) {
						/**use this set to make sure we don't check the same type of section two times (in most cases, it's just a huge performance drain) */
						const passedTypes = new Set<string>([expectedSection.constructor.name]);
						expectedSection = trimmedContext.currentSection;
						let newMostValid = indentData.expected;
						//loop over other possibilities, starting by the max indent possible at the moment and decrementing to the minimum
						while (true) {
							const constructorName = expectedSection.constructor.name;
							if (!passedTypes.has(constructorName)) {
								if (checkSection(expectedSection)) {
									indentData.mostValid = newMostValid;
									break;
								}
								passedTypes.add(constructorName);
							}

							const parent = expectedSection.getParentSection();
							if (parent) {
								newMostValid--;
								expectedSection = parent;
							}
							else
								break;
						}
					}

					const stacksToPop = indentData.expected - indentData.mostValid;

					popStacks(stacksToPop);
					//for debugger
					if (mostValidContext) {

						//merge parse result
						this.builder.addLine(mostValidContext.parseResult.tokens as SemanticTokenLine)
						this.parseResult.diagnostics.push(...mostValidContext.parseResult.diagnostics);


						//expectedIndentationCount = currentinden
						if (indentData.hasColon) {
							//when the no section was able to be created, create a new skriptsection
							newSection ||= new SkriptSection(mostValidContext.currentSection, mostValidContext);
							context.currentSection?.children.push(newSection);
							context.currentSection = newSection;
						}

						lastCodeLine = currentLineIndex;
						indentData.finishLine();
					}
				}

				//empty lines and comments should indentate like the lines above them
				this.suggestedIndentation[currentLineIndex] = indentData.correct;

				if (trimInfo.commentIndex != -1) {
					currentLineContext.addToken(TokenTypes.comment, trimInfo.commentIndex, currentLine.length - trimInfo.commentIndex);
				}
			}
			currentLineIndex++;
			currentLineStartPosition += currentLineTerminated.length;
		}
		popStacks(indentData.correct);

		//the file is updated! set outdated to false
		this.validated = true;
	}

	constructor(parent: SkriptFolder | SkriptWorkSpace, document: TextDocument) {
		super(parent, undefined);
		this.document = document;
		this.text = document.getText();
		this.builder = new UnOrderedSemanticTokensBuilder(this.document);
		this.parent = parent;
		this.patternContainer = new PatternTreeContainer(parent.getPatternTree());
		this.uri = URI.parse(document.uri);
	}
	toString(): string {
		const uri = this.document.uri;
		//uri will always have the same \ method, no matter what platform the coder is on
		return uri.substring(uri.lastIndexOf("/"));
	}
	format(): TextEdit[] {
		const edits: TextEdit[] = [];
		//loop over all lines and see what makes sense to do.
		//replace all spaces with tabs for now
		//when we find something which is probably the start of a new block like 'expression' or 'property', we set the recommended index to 0.
		//inside of functions, we don't modify indentation as long as it's safe (you may indentate 2 tabs backward, but not forward for example)
		const lines = this.text.split('\n');
		let recommendedIndentationLength = 0;
		for (const [index, line] of lines.entries()) {
			const currentIndentationLength = IndentData.getIndentationEndIndex(line);
			const trimInfo = SkriptFile.trimLineWithoutComments(line);
			const currentIndentation = line.substring(0, currentIndentationLength);
			const recommendedIndentation = '\t'.repeat(this.suggestedIndentation[index]);
			if (currentIndentation != recommendedIndentation) {
				edits.push(TextEdit.replace(Range.create({ line: index, character: 0 }, { line: index, character: currentIndentation.length }), recommendedIndentation));
			}
			if (trimInfo.trimmedLine.endsWith(':')) {
				recommendedIndentationLength++;
			}

		}
		return edits;
	}
}