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
	InitializeResult,
	DefinitionLink
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import {
	SkriptFile
} from "./SkriptFile";

import {
	SkriptContext
} from './SkriptContext';
import { SkriptWorkSpace } from './SkriptWorkSpace';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

//workspace folders
const currentWorkSpaces: SkriptWorkSpace[] = [];

//files without any workspace
const currentLooseFiles: SkriptFile[] = [];

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = true;
let hasDiagnosticRelatedInformationCapability = false;

function getSkriptWorkSpaceByUri(uri: string): SkriptWorkSpace | undefined {
	for (const ws of currentWorkSpaces) {
		if (ws.uri.startsWith(uri)) {
			return ws;
		}
	}
	return undefined;
}

function getLooseFileIndexByUri(uri: string): number | undefined {
	for (let i = 0; i < currentLooseFiles.length; i++) {
		if (currentLooseFiles[i].document.uri == uri) {
			return i;
		}
	}
	return undefined;
}

function getLooseFileByUri(uri: string): SkriptFile | undefined {
	for (const f of currentLooseFiles) {
		if (f.document.uri == uri) {
			return f;
		}
	}
	return undefined;
}

function getSkriptFileByUri(uri: string): SkriptFile | undefined {
	const ws = getSkriptWorkSpaceByUri(uri);
	if (ws) {
		return ws.getSkriptFileByUri(uri);
	}
	return getLooseFileByUri(uri);
}


connection.onInitialize((params: InitializeParams) => {
	if (params.workspaceFolders != null) {
		for (const folder of params.workspaceFolders)
			currentWorkSpaces.push(new SkriptWorkSpace(folder.uri));
	}
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
			},
			definitionProvider: true
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
	requireTabIndents: boolean;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: IntelliSkriptSettings = { requireTabIndents: false };
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
	const i = getLooseFileIndexByUri(e.document.uri);
	if (i != undefined) {
		currentLooseFiles.splice(i, 1);
	}
});



// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	const context = new SkriptContext(textDocument);

	const ws = getSkriptWorkSpaceByUri(textDocument.uri);

	if (ws) {

		let found = false;
		//update skriptfile for that workspace
		for (let i = 0; i < ws.files.length; i++) {
			if (ws.files[i].document.uri == textDocument.uri) {
				//temporarily delete (it's recalculating) so an error will be thrown if anything ever tries accessing a recalculating file
				delete ws.files[i];
				const currentFile = new SkriptFile(ws, context);
				ws.files[i] = currentFile;
				found = true;
				break;
			}
		}
		if (!found) {
			//add document to skript workspace
			ws.files.push(new SkriptFile(undefined, context));
		}
	}
	else {
		currentLooseFiles.push(new SkriptFile(undefined, context));
	}

	const diagnostics: Diagnostic[] = context.diagnostics;


	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

//connection.onDefinition(e => {//
//	return e.position;
//});

//examples:
//https://github.com/microsoft/vscode-languageserver-node/blob/main/testbed/server/src/server.ts

connection.onDefinition((params): DefinitionLink[] => {
	//check the line
	const f = getSkriptFileByUri(params.textDocument.uri);
	if (f) {
		const lines = f.document.getText().split('\n');
		const clickedLineText = lines[params.position.line];

		const variableRegex = /\{(.*?)\}/g;
		let match;
		const exactSection = f.getExactSectionAtLine(params.position.line);
		while ((match = variableRegex.exec(clickedLineText))) {
			if (params.position.character >= match.index && params.position.character < match.index + match[0].length) {
				//clicked on a variable
				const variable = exactSection.getVariableByName(match[1]);


				if (variable != undefined) {

					//return all reference locations
					const targetLineIndex = variable.firstReferenceLocation.range.start.line;
					const targetLine = f.document.getText().split('\n')[targetLineIndex];


					const targetLineRange = {
						start: { line: targetLineIndex, character: SkriptFile.getIndentationEndIndex(targetLine) },
						end: { line: targetLineIndex, character: targetLine.length }
					};
					return [{
						targetUri: variable.firstReferenceLocation.uri,
						targetRange: targetLineRange,
						targetSelectionRange: variable.firstReferenceLocation.range,
						originSelectionRange: {
							start: { line: params.position.line, character: match.index },
							end: { line: params.position.line, character: match.index + match[0].length }
						}
					}];
				}
			}
		}
	}
	//const currentDocumentText = params.textDocument.getText();
	return [];
});

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
	//TODO: update skriptfiles
	//validateTextDocument(new TextDocument(_change.changes[0].uri));
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
