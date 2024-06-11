import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity, Location } from 'vscode-languageserver/node';
import { SkriptNestHierarchy } from '../Nesting/SkriptNestHierarchy';
import * as IntelliSkriptConstants from '../IntelliSkriptConstants';
import { stopAtFirstResultProcessor } from '../Pattern/patternResultProcessor';
import { TokenModifiers } from '../TokenModifiers';
import { TokenTypes } from '../TokenTypes';
import { PatternType } from "../Pattern/PatternType";
import { SkriptSection } from "./Section/SkriptSection/SkriptSection";
import { SemanticToken, UnOrderedSemanticTokensBuilder } from './Section/UnOrderedSemanticTokensBuilder';
import { SkriptTypeState } from "./SkriptTypeState";
import { SkriptFile } from './Section/SkriptFile';
import { SkriptPatternCall } from '../Pattern/SkriptPattern';
import assert = require('assert');
import { SkriptPatternMatchHierarchy } from './SkriptPatternMatchHierarchy';
import { PatternData } from '../Pattern/Data/PatternData';

//TOODO: make context able to 'push' and 'pop' (make a function able to modify the context or create an instance while keeping reference to the same diagnostics list
export class SkriptContext {

	private referenceFields: {
		currentSection: SkriptSection | undefined;

	} = { currentSection: undefined };

	public get currentSection(): SkriptSection | undefined { return this.referenceFields.currentSection; }
	public set currentSection(newValue: SkriptSection | undefined) { this.referenceFields.currentSection = newValue; }

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
	constructor(currentSkriptFile: SkriptFile, currentString: string | undefined = undefined) {
		this.currentSkriptFile = currentSkriptFile;
		this.currentDocument = currentSkriptFile.document;
		this.currentString = currentString ?? this.currentDocument.getText();
	}

	//no popping as the popping will be done automatically (the garbage collector will clean it up
	push(newPosition: number, newSize: number = this.currentString.length - newPosition): SkriptContext {
		const subContext = new SkriptContext(
			this.currentSkriptFile,
			this.currentString.substring(newPosition, newPosition + newSize));

		subContext.currentSkriptFile = this.currentSkriptFile;
		subContext.referenceFields = this.referenceFields;
		subContext.currentPosition = this.currentPosition + newPosition;
		subContext.currentLine = this.currentLine;

		//subContext.hierarchy = this.hierarchy;//the more data, the better so we're keeping the hierarchical data from the higher levels for now
		return subContext;
	}

	//CAUTION! HIGHLIGHTING SHOULD BE DONE IN ORDER
	addToken(type: TokenTypes, relativePosition = 0, length = this.currentString.length, zIndex = 0, modifier: TokenModifiers = TokenModifiers.abstract): void {
		const absolutePosition = this.currentDocument.positionAt(this.currentPosition + relativePosition);
		this.currentSkriptFile.builder.push(new SemanticToken(absolutePosition, length, type, modifier, zIndex));
	}


	getLocation(start: number, length: number): Location {
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

	addDiagnostic(relativePosition: number, length: number, message: string, severity: DiagnosticSeverity = DiagnosticSeverity.Error, code?: string, data: unknown = undefined): void {
		if (severity == DiagnosticSeverity.Error) {
			this.hasErrors = true;
		}
		const diagnostic: Diagnostic = {
			severity: severity,
			range: {
				start: this.currentDocument.positionAt(this.currentPosition + relativePosition),
				end: this.currentDocument.positionAt(this.currentPosition + relativePosition + length)
			},
			message: message,
			source: 'IntelliSkript (click on the error code) -> ',
			data: data,
			code: code ? code : "IntelliSkript->Undocumented",
			codeDescription: { href: 'https://pex.li/intelliskript/' }//https://github.com/JohnHeikens/IntelliSkript/wiki
		};
		this.currentSkriptFile.diagnostics.push(diagnostic);
	}

	highLightRecursively(currentHierarchyNode: SkriptNestHierarchy): void {

		const HighLightDetails = (start: number, end: number) => {
			const length = end - start;
			if (currentHierarchyNode.character == '"') {
				this.addToken(TokenTypes.string, start, length);
			}
			else if (currentHierarchyNode.character == '{') {
				//token already added by document validator
			}
			else {
				let p: RegExpExecArray | null;
				let regEx = RegExp(IntelliSkriptConstants.NumberRegExp, "g");
				const lastIndex = start;
				while ((p = regEx.exec(this.currentString.substring(start, end)))) {
					this.addToken(TokenTypes.number, start + p.index, p[0].length);
				}
				regEx = RegExp(IntelliSkriptConstants.BooleanRegExp, "g");
				while ((p = regEx.exec(this.currentString.substring(start, end)))) {
					this.addToken(TokenTypes.keyword, start + p.index, p[0].length);
				}
				//check if any patterns are matched around here
				//this.addToken(TokenTypes.parameter, start, end, -1);
			}
		};

		let lastEnd = currentHierarchyNode.start;
		for (const child of currentHierarchyNode.children) {
			HighLightDetails(lastEnd, child.start);
			this.highLightRecursively(child);
			lastEnd = child.end;
		}
		HighLightDetails(lastEnd, currentHierarchyNode.end);
	}

	createHierarchy(addDiagnostics = false) {
		const openBraces = "{([";//< can also be used as operator so not including in brace list
		const closingBraces = "})]";
		this.hierarchy = new SkriptNestHierarchy(0, '');

		for (let i = 0; i < this.currentString.length; i++) {
			if (this.currentString[i] == '"') {
				const node = this.hierarchy.getActiveNode();
				if (node.character == '"') {
					if (this.currentString[i + 1] == '"') {
						i++; continue;//skip escaped string characters
					}
					else {
						node.end = i;//pop
					}
				}
				else {
					node.children.push(new SkriptNestHierarchy(i + 1, '"'));//push
				}
				//currentNestLevel++;

			}
			else if (this.currentString[i] == '%') {
				const node = this.hierarchy.getActiveNode();
				if (node.character == '"') {
					if (this.currentString[i + 1] == '%') {
						i++; continue;//skip escaped string characters
					}
				}
				if (node.character == '%') {
					node.end = i;//pop
				}
				else if (node.character == "") {
					if ((i == 0) || (this.currentString[i - 1].match(/[0-9]/) == null)) {//don't push for percentages
						node.children.push(new SkriptNestHierarchy(i + 1, '%'));//push
					}
				}
				//order is important here! "example".includes("") will return true!
				else if ("{\"".includes(node.character)) {
					node.children.push(new SkriptNestHierarchy(i + 1, '%'));//push
				}
				//else if(node.character.length > 0){
				//	// % is also needed for definition of effects so when node.character == "" then we'll allow the %'s
				//	this.addDiagnostic(i, 1, "can't use placeholder (%) characters here", DiagnosticSeverity.Error, "IntelliSkript->placeholder->wrongplace");
				//}
			}
			else if (openBraces.includes(this.currentString[i])) {
				const node = this.hierarchy.getActiveNode();
				if (node.character != '"') {//braces don't count in a string
					node.children.push(new SkriptNestHierarchy(i + 1, this.currentString[i]));//push
				}
			}
			else if (closingBraces.includes(this.currentString[i])) {
				const node = this.hierarchy.getActiveNode();

				if (node.character != '"') {//braces don't count in a string
					if (node.character.length && (closingBraces.indexOf(this.currentString[i]) == openBraces.indexOf(node.character))) {
						node.end = i;//pop
					}
					else if (addDiagnostics) {
						//unmatched closing brace found!
						this.addDiagnostic(i, 1, "unmatched closing character found", DiagnosticSeverity.Error, "IntelliSkript->Nest->UnMatched");
					}
				}
			}

		}

		if (addDiagnostics) {

			const lastActiveNode = this.hierarchy.getActiveNode();
			if (lastActiveNode != this.hierarchy) {
				this.addDiagnostic(lastActiveNode.start, 1, "no matching closing character found", DiagnosticSeverity.Error, "IntelliSkript->Nest->No Matching");
			}
		}
		this.hierarchy.end = this.currentString.length;
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
	addPatternMatch(data: PatternData, start = 0, end = this.currentString.length) {
		this.currentSkriptFile?.matches.children.push(new SkriptPatternMatchHierarchy(start + this.currentPosition, end + this.currentPosition, data));
	}
}

