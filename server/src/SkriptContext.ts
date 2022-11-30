import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import {
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
		return new SkriptContext(
			this.currentDocument,
			this.currentSection,
			this.currentPosition + newPosition,
			this.currentString.substring(newPosition, newPosition + newSize),
			this.diagnostics);
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
			code: code
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
				if (node.charachter == '"') {
					if (this.currentString[i + 1] == '"') {
						i++; continue;//skip escaped string charachters
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
				if (node.charachter == '%') {
					node.end = i;//pop
				}
				else if (node.charachter == "") {
					if (this.currentString[i - 1].match(/[0-1]/) == null) {//don't push for percentages
						node.children.push(new SkriptNestHierarchy(i, '%'));//push
					}
				}
				//order is important here! "example".includes("") will return true!
				else if ("{\"".includes(node.charachter)) {
					node.children.push(new SkriptNestHierarchy(i, '%'));//push
				}
				//else if(node.charachter.length > 0){
				//	// % is also needed for definition of effects so when node.charachter == "" then we'll allow the %'s
				//	this.addDiagnostic(i, 1, "can't use placeholder (%) charachters here", DiagnosticSeverity.Error, "IntelliSkript->placeholder->wrongplace");
				//}
			}
			else if (openBraces.includes(this.currentString[i])) {
				const node = this.hierarchy.getActiveNode();
				if (node.charachter != '"') {//braces don't count in a string
					node.children.push(new SkriptNestHierarchy(i, this.currentString[i]));//push
				}
			}
			else if (closingBraces.includes(this.currentString[i])) {
				const node = this.hierarchy.getActiveNode();

				if (node.charachter != '"') {//braces don't count in a string
					if (closingBraces.indexOf(this.currentString[i]) == openBraces.indexOf(node.charachter)) {
						node.end = i;//pop
					}
					else {
						//unmatched closing brace found!
						this.addDiagnostic(i, 1, "unmatched closing charachter found", DiagnosticSeverity.Error, "IntelliSkript->nest->unmatched");
					}
				}
			}

		}

		const lastActiveNode = this.hierarchy.getActiveNode();
		if (lastActiveNode != this.hierarchy) {
			this.addDiagnostic(lastActiveNode.start, 1, "no matching closing charachter found", DiagnosticSeverity.Error, "IntelliSkript->nest->no matching");
		}
		return this.hierarchy;


	}
}