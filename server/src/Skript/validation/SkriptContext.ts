import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity, Location, Range } from 'vscode-languageserver/node';
import { SkriptNestHierarchy } from '../../nesting/SkriptNestHierarchy';
import { TokenModifiers } from '../../TokenModifiers';
import { TokenTypes } from '../../TokenTypes';
import { SkriptSection } from "../section/skriptSection/SkriptSection";
import { SemanticToken } from '../section/UnOrderedSemanticTokensBuilder';
import { SkriptFile } from '../section/SkriptFile';
import { SkriptPatternMatchHierarchy } from '../../pattern/SkriptPatternMatchHierarchy';
import { PatternData } from '../../pattern/data/PatternData';
import { ParseResult } from './ParseResult';

//TOODO: make context able to 'push' and 'pop' (make a function able to modify the context or create an instance while keeping reference to the same diagnostics list
export class SkriptContext {

	//private referenceFields: {
	//	currentSection: SkriptSection | undefined;
	//} = { currentSection: undefined };
	//public get currentSection(): SkriptSection | undefined { return this.referenceFields.currentSection; }
	//public set currentSection(newValue: SkriptSection | undefined) { this.referenceFields.currentSection = newValue; }
	currentSection: SkriptSection;

	//determine if the current context has any errors
	hasErrors = false;

	//reference variables
	currentSkriptFile: SkriptFile;
	currentDocument: TextDocument;


	//variables which can change in push()
	parent: SkriptContext | undefined = undefined;
	currentString = "";
	currentPosition = 0;
	currentLine = 0;

	hierarchy: SkriptNestHierarchy | undefined = undefined;

	parseResult: ParseResult;

	constructor(currentSkriptFile: SkriptFile, currentString: string | undefined = undefined) {
		this.currentSkriptFile = currentSkriptFile;
		this.currentDocument = currentSkriptFile.document;
		this.currentString = currentString ?? this.currentDocument.getText();
		this.parseResult = currentSkriptFile.parseResult;
		this.currentSection = currentSkriptFile;
	}

	//no popping as the popping will be done automatically (the garbage collector will clean it up
	push(newPosition: number, newSize: number = this.currentString.length - newPosition): SkriptContext {
		const subContext = new SkriptContext(
			this.currentSkriptFile,
			this.currentString.substring(newPosition, newPosition + newSize));

		subContext.currentSkriptFile = this.currentSkriptFile;
		subContext.currentSection = this.currentSection;
		subContext.currentPosition = this.currentPosition + newPosition;
		subContext.currentLine = this.currentLine;
		subContext.parseResult = this.parseResult;

		//subContext.hierarchy = this.hierarchy;//the more data, the better so we're keeping the hierarchical data from the higher levels for now
		return subContext;
	}

	//CAUTION! HIGHLIGHTING SHOULD BE DONE IN ORDER
	addToken(type: TokenTypes, relativePosition = 0, length = this.currentString.length - relativePosition, modifiers: TokenModifiers[] = []): void {
		const absolutePosition = this.currentDocument.positionAt(this.currentPosition + relativePosition);
		this.parseResult.tokens.push(new SemanticToken(absolutePosition, length, type, SemanticToken.modToFlags(modifiers)));
	}


	getLocation(start: number = 0, length: number = this.currentString.length): Location {
		const StartPosition = this.currentDocument.positionAt(this.currentPosition + start);
		return {
			uri: this.currentDocument.uri,
			range: {
				start: StartPosition,
				end: {
					line: StartPosition.line,
					character: StartPosition.character + length
				}
			}
		};
	}

	addDiagnosticAbsolute(absoluteRange: Range, message: string, severity: DiagnosticSeverity = DiagnosticSeverity.Error, code?: string, data: unknown = undefined) {
		if (severity == DiagnosticSeverity.Error) {
			this.hasErrors = true;
		}
		const diagnostic: Diagnostic = {
			severity: severity,
			range: absoluteRange,
			message: message,
			source: 'IntelliSkript (click on the error code) -> ',
			data: data,
			code: code ? code : "IntelliSkript->Undocumented",
			codeDescription: { href: 'https://github.com/JohnHeikens/intelliSkript/wiki' }//https://github.com/JohnHeikens/intelliSkript/wiki
		};
		this.parseResult.diagnostics.push(diagnostic);
	}

	addDiagnostic(relativePosition: number, length: number, message: string, severity: DiagnosticSeverity = DiagnosticSeverity.Error, code?: string, data: unknown = undefined): void {
		this.addDiagnosticAbsolute({
			start: this.currentDocument.positionAt(this.currentPosition + relativePosition),
			end: this.currentDocument.positionAt(this.currentPosition + relativePosition + length)
		}, message, severity, code, data);
	}

	getHierarchy(addDiagnostics = false) {
		if (this.hierarchy) return this.hierarchy;
		const openBraces = "{([";//< can also be used as operator so not including in brace list
		const closingBraces = "})]";
		this.hierarchy = new SkriptNestHierarchy(0, '');

		for (let i = 0; i < this.currentString.length; i++) {
			const currentChar = this.currentString[i];
			if (currentChar == '"') {
				const node = this.hierarchy.getActiveNode();
				if (node.delimiter == '"') {
					if (this.currentString[i + 1] == '"') {
						i++; continue;//skip escaped string characters
					}
					else {
						node.end = i;//pop
					}
				}
				else if ('%(,'.includes(node.delimiter)) {
					node.children.push(new SkriptNestHierarchy(i + 1, '"'));//push
				}
				//currentNestLevel++;

			}
			else if (currentChar == '%') {
				const node = this.hierarchy.getActiveNode();
				if (node.delimiter == '"') {
					if (this.currentString[i + 1] == '%') {
						i++; continue;//skip escaped string characters
					}
				}
				if (node.delimiter == '%') {
					node.end = i;//pop
				}
				else if (node.delimiter == "") {
					if ((i == 0) || (this.currentString[i - 1].match(/[0-9]/) == null)) {//don't push for percentages
						node.children.push(new SkriptNestHierarchy(i + 1, '%'));//push
					}
				}
				//order is important here! "example".includes("") will return true!
				else if ("{\"".includes(node.delimiter)) {
					node.children.push(new SkriptNestHierarchy(i + 1, '%'));//push
				}
				//else if(node.character.length > 0){
				//	// % is also needed for definition of effects so when node.character == "" then we'll allow the %'s
				//	this.addDiagnostic(i, 1, "can't use placeholder (%) characters here", DiagnosticSeverity.Error, "IntelliSkript->placeholder->wrongplace");
				//}
			}
			else if (currentChar == ',') {
				const node = this.hierarchy.getActiveNode();
				if (node.delimiter == '(')
					//first child
					node.children.push(new SkriptNestHierarchy(i + 1, ','));

				else if (node.delimiter == ',') {
					//pop last ',' child
					node.end = i;
					//add new ',' node to parent node
					this.hierarchy.getActiveNode().children.push(new SkriptNestHierarchy(i + 1, ','));
				}
			}
			else if (openBraces.includes(currentChar)) {
				const node = this.hierarchy.getActiveNode();
				if (node.delimiter != '"') {//braces don't count in a string
					node.children.push(new SkriptNestHierarchy(i + 1, currentChar));//push
				}
			}
			else if (closingBraces.includes(currentChar)) {
				const node = this.hierarchy.getActiveNode();

				if (node.delimiter != '"') {//braces don't count in a string
					if (node.delimiter == ',' && currentChar == ')') {
						//pop ',' node
						node.end = i;
						//pop '(' node. we know for sure that a ',' node is always nested in a '(' node
						this.hierarchy.getActiveNode().end = i;
					}
					else if (node.delimiter.length && (closingBraces.indexOf(currentChar) == openBraces.indexOf(node.delimiter))) {
						node.end = i;//pop
					}
					else if (addDiagnostics) {
						//unmatched closing brace found!
						this.addDiagnostic(i, 1, "unmatched closing character found", DiagnosticSeverity.Error, "IntelliSkript->Nest->UnMatched");
					}
				}
			}
		}

		this.hierarchy.end = this.currentString.length;
		let lastActiveNode: SkriptNestHierarchy = this.hierarchy;
		while (true) {
			const lastActiveChildNode: SkriptNestHierarchy | undefined = lastActiveNode.getActiveChildNode();
			if (!lastActiveChildNode) break;
			if (addDiagnostics) {
				if (lastActiveChildNode != this.hierarchy) {
					this.addDiagnostic(lastActiveChildNode.start, this.hierarchy.end - lastActiveChildNode.start, "no matching closing character found", DiagnosticSeverity.Error, "IntelliSkript->Nest->No Matching");
				}
			}
			//remove this node
			lastActiveNode.children.pop();

			lastActiveNode = lastActiveChildNode;
		};
		return this.hierarchy;


	}
	hierarchicFind(toFind: RegExp, start = 0, end = this.currentString.length): RegExpExecArray[] {
		const results: RegExpExecArray[] = [];
		if (this.hierarchy) {
			let index = start;
			let childIndex = 0;
			let currentResult;
			while (childIndex < this.hierarchy.children.length) {
				let nextSubIndex = this.hierarchy.children[childIndex].start;
				if (nextSubIndex > index) {
					if (nextSubIndex > end) {
						nextSubIndex = end;
					}
					while ((currentResult = toFind.exec(this.currentString.substring(index, nextSubIndex)))) {
						currentResult.index += index;
						results.push(currentResult);
					}
					if (nextSubIndex == end) {
						return results;
					}
				}
				index = this.hierarchy.children[childIndex].end + 1;
				childIndex++;
			}
			while ((currentResult = toFind.exec(this.currentString.substring(index, end)))) {
				currentResult.index += index;
				results.push(currentResult);
			}
		}

		return results;
	}
	splitHierarchically(delimiter: RegExp, start = 0, end = this.currentString.length): { text: string, index: number }[] {
		const indexes = this.hierarchicFind(delimiter, start, end);
		const results = Array(indexes.length + 1);
		let currentIndex = start;
		for (let i = 0; i < indexes.length; i++) {
			results[i] = { text: this.currentString.substring(currentIndex, indexes[i].index), index: currentIndex };
			currentIndex = indexes[i].index + indexes[i].length;
		}
		results[indexes.length] = { text: this.currentString.substring(currentIndex, end), index: currentIndex };
		return results;
	}
	/**expects start and end! */
	addPatternMatch(data: PatternData, start = 0, end = this.currentString.length) {
		this.currentSkriptFile?.matches.addNestedChild(new SkriptPatternMatchHierarchy(start + this.currentPosition, end + this.currentPosition, data));
	}
}

