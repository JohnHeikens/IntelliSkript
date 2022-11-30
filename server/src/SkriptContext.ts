import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import {
	CodeDescription,
	Diagnostic, DiagnosticSeverity, Location, Range
} from 'vscode-languageserver/node';
import { SkriptNestHierarchy } from './Nesting/SkriptNestHierarchy';

import {
	SkriptSection
} from "./Section/SkriptSection";

//TOODO: make context able to 'push' and 'pop' (make a function able to modify the context or create an instance while keeping reference to the same diagnostics list
export class SkriptContext {
	//reference variables
	currentDocument: TextDocument;
	diagnostics: Diagnostic[] = [];

	parent: SkriptContext | undefined = undefined;
	currentString = "";
	currentPosition = 0;
	currentSection: SkriptSection | undefined = undefined;
	hierarchy: SkriptNestHierarchy | undefined = undefined;
	constructor(currentDocument: TextDocument, currentSection: SkriptSection | undefined = undefined, currentPosition = 0, currentString: string | undefined = undefined, diagnostics: Diagnostic[] = []) {
		this.currentPosition = currentPosition;
		this.currentString = currentString == undefined ? currentDocument.getText() : currentString;
		this.currentDocument = currentDocument;
		this.diagnostics = diagnostics;
		this.currentSection = currentSection;
	}

	//no popping as the popping will be done automatically (the garbage collector will clean it up
	push(newPosition: number, newSize: number): SkriptContext {
		const subContext = new SkriptContext(
			this.currentDocument,
			this.currentSection,
			this.currentPosition + newPosition,
			this.currentString.substring(newPosition, newPosition + newSize),
			this.diagnostics);
		//subContext.hierarchy = this.hierarchy;//the more data, the better so we're keeping the hierarchical data from the higher levels for now
		return subContext;
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
	createHierarchy() {
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
					node.children.push(new SkriptNestHierarchy(i, '"'));//push
				}
				//currentNestLevel++;

			}
			else if (this.currentString[i] == '%') {
				const node = this.hierarchy.getActiveNode();
				if (node.character == '%') {
					node.end = i;//pop
				}
				else if (node.character == "") {
					if (this.currentString[i - 1].match(/[0-9]/) == null) {//don't push for percentages
						node.children.push(new SkriptNestHierarchy(i, '%'));//push
					}
				}
				//order is important here! "example".includes("") will return true!
				else if ("{\"".includes(node.character)) {
					node.children.push(new SkriptNestHierarchy(i, '%'));//push
				}
				//else if(node.character.length > 0){
				//	// % is also needed for definition of effects so when node.character == "" then we'll allow the %'s
				//	this.addDiagnostic(i, 1, "can't use placeholder (%) characters here", DiagnosticSeverity.Error, "IntelliSkript->placeholder->wrongplace");
				//}
			}
			else if (openBraces.includes(this.currentString[i])) {
				const node = this.hierarchy.getActiveNode();
				if (node.character != '"') {//braces don't count in a string
					node.children.push(new SkriptNestHierarchy(i, this.currentString[i]));//push
				}
			}
			else if (closingBraces.includes(this.currentString[i])) {
				const node = this.hierarchy.getActiveNode();

				if (node.character != '"') {//braces don't count in a string
					if (closingBraces.indexOf(this.currentString[i]) == openBraces.indexOf(node.character)) {
						node.end = i;//pop
					}
					else {
						//unmatched closing brace found!
						this.addDiagnostic(i, 1, "unmatched closing character found", DiagnosticSeverity.Error, "IntelliSkript->nest->unmatched");
					}
				}
			}

		}

		const lastActiveNode = this.hierarchy.getActiveNode();
		if (lastActiveNode != this.hierarchy) {
			this.addDiagnostic(lastActiveNode.start, 1, "no matching closing character found", DiagnosticSeverity.Error, "IntelliSkript->nest->no matching");
		}
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
	splitHierarchically(delimiter: RegExp, start = 0, end = this.currentString.length): string[] {
		const indexes = this.hierarchicFind(delimiter, start, end);
		const results = Array(indexes.length + 1);
		let currentIndex = start;
		for (let i = 0; i < indexes.length; i++) {
			results[i] = this.currentString.substring(currentIndex, indexes[i].index);
			currentIndex = indexes[i].index + indexes[i].length;
		}
		results[indexes.length] = this.currentString.substring(currentIndex, end);
		return results;
	}
}