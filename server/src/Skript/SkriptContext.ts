import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import {
	Diagnostic, DiagnosticSeverity
} from 'vscode-languageserver/node';
import { SkriptNestHierarchy } from '../Nesting/SkriptNestHierarchy';

import {
	SkriptSection
} from "./Section/SkriptSection";
import { SemanticToken, UnOrderedSemanticTokensBuilder } from './Section/UnOrderedSemanticTokensBuilder';
import { TokenModifiers } from '../TokenModifiers';
import { TokenTypes } from '../TokenTypes';
import { SkriptFile } from './Section/SkriptFile';

//TOODO: make context able to 'push' and 'pop' (make a function able to modify the context or create an instance while keeping reference to the same diagnostics list
export class SkriptContext {

	referenceFields: {
		currentSection: SkriptSection | undefined;

	} = { currentSection: undefined };

	public get currentSection(): SkriptSection | undefined { return this.referenceFields.currentSection; }
	public set currentSection(newValue: SkriptSection | undefined) { this.referenceFields.currentSection = newValue; }

	//reference variables
	currentSkriptFile: SkriptFile | undefined;
	currentDocument: TextDocument;
	currentBuilder: UnOrderedSemanticTokensBuilder = new UnOrderedSemanticTokensBuilder();
	diagnostics: Diagnostic[] = [];

	//variables which can change in push()
	parent: SkriptContext | undefined = undefined;
	currentString = "";
	currentPosition = 0;
	hierarchy: SkriptNestHierarchy | undefined = undefined;
	constructor(currentDocument: TextDocument, currentString: string | undefined = undefined, currentBuilder: UnOrderedSemanticTokensBuilder = new UnOrderedSemanticTokensBuilder()) {
		this.currentString = currentString == undefined ? currentDocument.getText() : currentString;
		this.currentDocument = currentDocument;
		this.currentBuilder = currentBuilder;
	}

	//no popping as the popping will be done automatically (the garbage collector will clean it up
	push(newPosition: number, newSize: number = this.currentString.length - newPosition): SkriptContext {
		const subContext = new SkriptContext(
			this.currentDocument,
			this.currentString.substring(newPosition, newPosition + newSize),
			this.currentBuilder);

		subContext.currentSkriptFile = this.currentSkriptFile;
		subContext.referenceFields = this.referenceFields;
		subContext.currentPosition = this.currentPosition + newPosition;
		subContext.diagnostics = this.diagnostics;

		//subContext.hierarchy = this.hierarchy;//the more data, the better so we're keeping the hierarchical data from the higher levels for now
		return subContext;
	}

	//CAUTION! HIGHLIGHTING SHOULD BE DONE IN ORDER
	addToken(relativePosition: number, length: number, type: TokenTypes, modifier: TokenModifiers = TokenModifiers.abstract): void {
		const absolutePosition = this.currentDocument.positionAt(this.currentPosition + relativePosition);
		this.currentBuilder.push(new SemanticToken(absolutePosition, length, type, modifier));
	}

	addDiagnostic(relativePosition: number, length: number, message: string, severity: DiagnosticSeverity = DiagnosticSeverity.Error, code: string | undefined = undefined, data: unknown = undefined): void {
		const diagnostic: Diagnostic = {
			severity: severity,
			range: {
				start: this.currentDocument.positionAt(this.currentPosition + relativePosition),
				end: this.currentDocument.positionAt(this.currentPosition + relativePosition + length)
			},
			message: message,
			source: 'IntelliSkript',
			data: data,
			code: code,
			codeDescription: { href: 'https://github.com/JohnHeikens/IntelliSkript/wiki' }
		};
		this.diagnostics.push(diagnostic);
	}

	highLightRecursively(currentHierarchyNode: SkriptNestHierarchy): void {

		const HighLightDetails = (start: number, end: number) => {
			const length = end - start;
			if (currentHierarchyNode.character == '"') {
				this.addToken(start, length, TokenTypes.string);
			}
			else if (currentHierarchyNode.character == '{') {
				this.addToken(start, length, TokenTypes.variable);
			}
			else {
				const numberRegExp = /\b(?<!\.)[0-9]{1,}(\.[0-9]{1,}|)(?!\.)\b/g;
				let p: RegExpExecArray | null;
				const lastIndex = start;
				while ((p = numberRegExp.exec(this.currentString.substring(start, end)))) {
					//this.addToken(lastIndex, (start + p.index) - lastIndex, TokenTypes.number);
					this.addToken(start + p.index, p[0].length, TokenTypes.number);
				}
				//this.addToken(lastIndex, end - lastIndex, TokenTypes.keyword);
			}
		};

		let lastEnd = currentHierarchyNode.start;
		for (const child of currentHierarchyNode.children) {
			HighLightDetails(lastEnd, child.start + 1);
			this.highLightRecursively(child);
			//this.addToken(lastEnd, child.start - lastEnd, TokenTypes.string);
			lastEnd = child.end;
		}
		HighLightDetails(lastEnd, currentHierarchyNode.end + 1);
		//this.addToken(lastEnd, currentHierarchyNode.end + 1 - lastEnd, TokenTypes.string);
		//for (const child of currentHierarchyNode.children) {
		//	this.highLightRecursively(child);
		//}
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
					node.children.push(new SkriptNestHierarchy(i + 1, node.character));//push
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
						this.addDiagnostic(i, 1, "unmatched closing character found", DiagnosticSeverity.Error, "IntelliSkript->nest->unmatched");
					}
				}
			}

		}

		if (addDiagnostics) {

			const lastActiveNode = this.hierarchy.getActiveNode();
			if (lastActiveNode != this.hierarchy) {
				this.addDiagnostic(lastActiveNode.start, 1, "no matching closing character found", DiagnosticSeverity.Error, "IntelliSkript->nest->no matching");
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
}