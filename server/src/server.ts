/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// IntelliSkript settings
interface IntelliSkriptSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: IntelliSkriptSettings = { maxNumberOfProblems: 1000 };
let globalSettings: IntelliSkriptSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<IntelliSkriptSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <IntelliSkriptSettings>(
			(change.settings.intelliSkript || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<IntelliSkriptSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'intelliSkript'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	const text = textDocument.getText();
	//const pattern = /check\[.*?\]/g; // /\b[A-Z]{2,}\b/g;
	//let m: RegExpExecArray | null;
	let problems = 0;
	const diagnostics: Diagnostic[] = [];

	//loop over all lines in the skript file and check for errors

	const lines = text.split("\n");
	let currentLineIndex = 0;
	let currentLineStartPosition = 0;
	const currentType = "";

	const allowedStartTokens: string[] = ["function", "effect", "condition", "on"];
	let expectedIndentationCount = 0;
	let currentIndentationString = "";

	while ((currentLineIndex < lines.length) && (problems < settings.maxNumberOfProblems)) {

		const currentLine = lines[currentLineIndex];
		//trim comments off

		const commentIndex = currentLine.search(/(?<!#)#(?!#)/);

		const lineWithoutComments = commentIndex == -1 ? currentLine : currentLine.substring(0, commentIndex);

		const trimmedLine = lineWithoutComments.trim();



		if (trimmedLine.length != 0) {
			//check for invalid amounts of spaces

			const indentationEndIndex = currentLine.search(/(?!( |\t))/);

			let currentType = "";

			if (trimmedLine.endsWith(":")) {
				currentType = "section";

				//currentType = 'command';
			}

			if (indentationEndIndex == 0) {
				if (currentType == "section") {
					currentIndentationString = "";
				}
				else {
					++problems;
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Error,
						range: {
							start: textDocument.positionAt(currentLineStartPosition),
							end: textDocument.positionAt(currentLineStartPosition + trimmedLine.length)
						},
						message: `can't understand this line`,
						source: 'ex'
					};
					diagnostics.push(diagnostic);
				}
			}
			else {
				const indentationString = currentLine.substring(0, indentationEndIndex);
				const inverseIndentationType = (indentationString[0] == " ") ? "\t" : " ";
				if (indentationString.includes(inverseIndentationType)) {
					++problems;
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Error,
						range: {
							start: textDocument.positionAt(currentLineStartPosition + Math.floor(indentationEndIndex / 4) * 4),
							end: textDocument.positionAt(currentLineStartPosition + indentationEndIndex)
						},
						message: `indentation error: do not mix tabs and spaces` + indentationEndIndex,
						source: 'ex'
					};
					diagnostics.push(diagnostic);
				}
				else {
					if (currentIndentationString == "") {
						currentIndentationString = indentationString;
					}
					else {
						const currentExpectedIndentationCharachterCount = expectedIndentationCount * currentIndentationString.length;
						if ((indentationEndIndex > currentExpectedIndentationCharachterCount) || (indentationEndIndex % currentIndentationString.length) != 0) {
							
								++problems;
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: {
									start: textDocument.positionAt(currentLineStartPosition + Math.floor(indentationEndIndex / 4) * 4),
									end: textDocument.positionAt(currentLineStartPosition + indentationEndIndex)
								},
								message: `indentation error: expected ` + currentExpectedIndentationCharachterCount + (currentIndentationString[0] == " " ? " space" : " tab") + (currentExpectedIndentationCharachterCount == 1 ? "" : "s") + ` but found ` + indentationEndIndex,
								source: 'ex'
							};
							diagnostics.push(diagnostic);
						}
					}
				}
			}

			if (currentType == "section") {

				expectedIndentationCount++;
			}

		}


		currentLineIndex++;
		currentLineStartPosition += currentLine.length + 1;
	}

	//while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
	//	problems++;
	//	const diagnostic: Diagnostic = {
	//		severity: DiagnosticSeverity.Warning,
	//		range: {
	//			start: textDocument.positionAt(m.index),
	//			end: textDocument.positionAt(m.index + m[0].length)
	//		},
	//		message: `${m[0]} is all uppercase.`,
	//		source: 'ex'
	//	};
	//	if (hasDiagnosticRelatedInformationCapability) {
	//		diagnostic.relatedInformation = [
	//			{
	//				location: {
	//					uri: textDocument.uri,
	//					range: Object.assign({}, diagnostic.range)
	//				},
	//				message: 'Spelling matters'
	//			},
	//			{
	//				location: {
	//					uri: textDocument.uri,
	//					range: Object.assign({}, diagnostic.range)
	//				},
	//				message: 'Particularly for names'
	//			}
	//		];
	//	}
	//	diagnostics.push(diagnostic);
	//}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
