import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import {
	Diagnostic, DiagnosticSeverity, Range
} from  'vscode-languageserver/node';

import {
	SkriptSection
} from "./SkriptSection";

export class SkriptContext {
	currentDocument: TextDocument;
	currentString: string;
	currentPosition: number;
	diagnostics: Diagnostic[];
	currentSection: SkriptSection | undefined;
	constructor(currentDocument: TextDocument, currentSection: SkriptSection | undefined = undefined, currentLine = "", currentPosition = 0, diagnostics: Diagnostic[] = []) {
		this.currentPosition = currentPosition;
		this.currentString = currentLine;
		this.currentDocument = currentDocument;
		this.diagnostics = diagnostics;
		this.currentSection = currentSection;
	}
	addDiagnostic(startPosition: number, length: number, message: string, severity = DiagnosticSeverity.Error): void {
		const diagnostic: Diagnostic = {
			severity: severity,
			range: {
				start: this.currentDocument.positionAt(startPosition),
				end: this.currentDocument.positionAt(startPosition + length)
			},
			message: message,
			source: 'IntelliSkript'
		};
		this.diagnostics.push(diagnostic);
	}
}