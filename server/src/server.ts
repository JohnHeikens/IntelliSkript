/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
	DefinitionLink,
	WorkspaceChange,
	ChangeAnnotation,
	CodeAction,
	CodeActionKind,
	SemanticTokensRegistrationOptions,
	SemanticTokensLegend,
	SemanticTokensClientCapabilities,
	SemanticTokensRegistrationType,
	DocumentSelector,
	SymbolInformation,
	SymbolKind
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import {
	SkriptFile
} from "./Skript/Section/SkriptFile";

import {
	SkriptContext
} from './Skript/SkriptContext';
import { SkriptWorkSpace } from './Skript/Section/SkriptWorkSpace';
import assert = require('assert');
import { TokenTypes } from './TokenTypes';
import { AddonParser, intelliSkriptAddonSkFilesDirectory } from './Skript/Addon Parser/AddonParser';
import path = require('path');
import * as fs from 'fs';
import { IntelliSkriptConstants } from './IntelliSkriptConstants';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

//workspace folders
const currentWorkSpaces: SkriptWorkSpace[] = [];

let addonFileWorkSpace: SkriptWorkSpace;
//files without any workspace
let looseWorkSpace: SkriptWorkSpace;//SkriptFile[] = [];

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = true;
let hasDiagnosticRelatedInformationCapability = false;

function getSkriptWorkSpaceByFileUri(uri: string): SkriptWorkSpace | undefined {
	for (const ws of currentWorkSpaces) {
		if (ws.uri?.startsWith(uri)) {
			return ws;
		}
	}
	return looseWorkSpace;
	//return undefined;
}

function getSkriptFileByUri(uri: string): SkriptFile | undefined {
	const ws = getSkriptWorkSpaceByFileUri(uri);
	if (ws) {
		return ws.getSkriptFileByUri(uri);
	}
	else {
		return looseWorkSpace.getSkriptFileByUri(uri);
	}
}

let semanticTokensLegend: SemanticTokensLegend | undefined;
function computeLegend(capability: SemanticTokensClientCapabilities): SemanticTokensLegend {

	const clientTokenTypes = new Set<string>(capability.tokenTypes);
	const clientTokenModifiers = new Set<string>(capability.tokenModifiers);

	const tokenTypes: string[] = [];
	for (let i = 0; i < TokenTypes.length; i++) {
		const str = TokenTypes[i];
		if (clientTokenTypes.has(str)) {
			tokenTypes.push(str);
		} else {
			if (str === 'lambdaFunction') {
				tokenTypes.push('function');
			} else {
				tokenTypes.push('type');
			}
		}
	}

	const tokenModifiers: string[] = [];
	for (let i = 0; i < tokenModifiers.length; i++) {
		const str = tokenModifiers[i];
		if (clientTokenModifiers.has(str)) {
			tokenModifiers.push(str);
		}
	}

	return { tokenTypes, tokenModifiers };
}

connection.onInitialize((params: InitializeParams) => {
	//currentWorkSpaces.push(new SkriptWorkSpace());
	if (params.workspaceFolders != null) {
		for (const folder of params.workspaceFolders) {
			const ws = new SkriptWorkSpace(addonFileWorkSpace, folder.uri);
			ws.parent = addonFileWorkSpace;
			//ws.eventPatterns = addonFileWorkSpace.eventPatterns;//TODO: clone patterns to workspace
			currentWorkSpaces.push(ws);
		}
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


	semanticTokensLegend = computeLegend(params.capabilities.textDocument!.semanticTokens!);
	//return result;
	return new Promise((resolve, reject) => {
		//const result: InitializeResult = {
		//	capabilities: {
		//		textDocumentSync: TextDocumentSyncKind.Incremental,
		//		// Tell the client that this server supports code completion.
		//		//completionProvider: {
		//		//	resolveProvider: true
		//		//},
		//		definitionProvider: true,
		//		codeActionProvider: true
		//	}
		//};
		const result: InitializeResult = {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Incremental,

				// Tell the client that this server supports code completion.
				//completionProvider: {
				//	resolveProvider: true
				//},
				definitionProvider: true,
				codeActionProvider: true,
				//textDocumentSync: TextDocumentSyncKind.Full,
				//hoverProvider: true,
				//completionProvider: {
				//	triggerCharacters: ['.'],
				//	allCommitCharacters: [';'],
				//	resolveProvider: false,
				//},
				//signatureHelpProvider: {
				//},
				//definitionProvider: true,
				//referencesProvider: { workDoneProgress: true },
				//documentHighlightProvider: true,
				//documentSymbolProvider: true,
				//workspaceSymbolProvider: true,
				//codeActionProvider: {
				//	codeActionKinds: [CodeActionKind.Refactor],//, CodeActionKind.Source, CodeActionKind.SourceOrganizeImports],
				//	resolveProvider: true
				//},
				//codeLensProvider: {
				//	resolveProvider: true
				//},
				//documentFormattingProvider: true,
				//documentRangeFormattingProvider: true,
				//documentOnTypeFormattingProvider: {
				//	firstTriggerCharacter: ';',
				//	moreTriggerCharacter: ['{', '\n']
				//},
				//renameProvider: true,
				//workspace: {
				//	workspaceFolders: {
				//		supported: true,
				//		changeNotifications: true
				//	}
				//},
				//implementationProvider: {
				//	id: 'AStaticImplementationID',
				//	documentSelector: ['bat']
				//},
				//typeDefinitionProvider: true,
				//declarationProvider: { workDoneProgress: true },
				//executeCommandProvider: {
				//	commands: ['testbed.helloWorld']
				//},
				//callHierarchyProvider: true,
				//selectionRangeProvider: { workDoneProgress: true },
				//diagnosticProvider: {
				//	identifier: 'testbed',
				//	interFileDependencies: true,
				//	workspaceDiagnostics: false
				//},
				//notebookDocumentSync: {
				//	notebookSelector: [{
				//		cells: [{ language: 'bat'}]
				//	}]
				//}
			}
		};
		if (hasWorkspaceFolderCapability) {
			result.capabilities.workspace = {
				workspaceFolders: {
					supported: true
				}
			};
		}
		setTimeout(() => {
			resolve(result);
		}, 50);
	});
});



function InitializeAddonSkripts() {
	addonFileWorkSpace = new SkriptWorkSpace(undefined, intelliSkriptAddonSkFilesDirectory);

	fs.readdir(intelliSkriptAddonSkFilesDirectory, undefined, function (err: NodeJS.ErrnoException | null, files: string[]) {
		if (err) {
			console.error("Could not list the directory.", err);
			process.exit(1);
		}

		files.forEach(function (file, index) {
			// Make one pass and make the file complete
			const completePath = path.join(intelliSkriptAddonSkFilesDirectory, file);

			const document = TextDocument.create("file:///" + completePath, "sk", 0, fs.readFileSync(completePath, "utf8"));
			const context = new SkriptContext(document);
			const skriptFile = new SkriptFile(addonFileWorkSpace, context);
			addonFileWorkSpace.files.push(skriptFile);
		});
	});
	looseWorkSpace = new SkriptWorkSpace(addonFileWorkSpace);
}
function delay(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
connection.onInitialized(async () => {

	//works for the client only
	//const myExtDir = vscode.extensions.getExtension ("JohnHeikens.IntelliSkript").extensionPath;
	if (!IntelliSkriptConstants.IsReleaseMode) {
		AddonParser.ParseFiles();
		//await delay(1000);//give the debugger time to start

	}

	InitializeAddonSkripts();

	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}

	//compatibility with all main vscode plugins
	const sel: DocumentSelector = [
		{ pattern: '**/*.sk' }
		//{ language: 'skript' },
		//{ language: 'Sk-VSC' },
		//{ language: 'sk' },
		//{ language: 'skriptlang' }
	];

	const settings = await getGlobalSettings();

	if (settings.UseColorTheme) {

		assert(semanticTokensLegend != undefined);
		const registrationOptions: SemanticTokensRegistrationOptions = {
			documentSelector: sel,
			legend: semanticTokensLegend,
			range: false,
			full: {
				delta: true
			}
		};
		void connection.client.register(SemanticTokensRegistrationType.type, registrationOptions);
	}
});

// IntelliSkript settings
interface IntelliSkriptSettings {
	requireTabIndents: boolean;
	UseColorTheme: boolean;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: IntelliSkriptSettings = {
	requireTabIndents: false,
	UseColorTheme: true
};
let globalSettings: IntelliSkriptSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<IntelliSkriptSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <IntelliSkriptSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
	//if (change.settings != null) {
	//	if (hasConfigurationCapability) {
	//		// Reset all cached document settings
	//		documentSettings.clear();
	//	}// else {
	//	//}
	//	globalSettings = <IntelliSkriptSettings>(
	//		(change.settings.intelliSkript || defaultSettings)
	//	);
	//
	//	// Revalidate all open text documents
	//	documents.all().forEach(validateTextDocument);
	//}
});

//function getDocumentSettings(resource: string): Thenable<IntelliSkriptSettings> {
//	if (!hasConfigurationCapability) {
//		return Promise.resolve(globalSettings);
//	}
//	let result = documentSettings.get(resource);
//	if (!result) {
//		result = connection.workspace.getConfiguration({
//			scopeUri: resource,
//			section: 'intelliSkript'
//		});
//		documentSettings.set(resource, result);
//	}
//	return result;
//}

function getGlobalSettings(): Thenable<IntelliSkriptSettings> {
	const settings = connection.workspace.getConfiguration("IntelliSkript");
	return settings;
}

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
	const ws = getSkriptWorkSpaceByFileUri(e.document.uri);
	if (ws) {
		const fileIndex = ws.getSkriptFileIndexByUri(e.document.uri);
		if (fileIndex != undefined) {
			ws.files.splice(fileIndex, 1);
		}
	}
});



// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	//const settings = await getDocumentSettings(textDocument.uri); //will pause execution of this and mess up coloring of documents
	//const settings = getDocumentSettings(textDocument.uri);

	const context = new SkriptContext(textDocument);

	const ws = getSkriptWorkSpaceByFileUri(textDocument.uri);

	if (ws) {
		ws.validateTextDocument(textDocument, context);
	}

	const diagnostics: Diagnostic[] = context.diagnostics;


	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

//examples:
//https://github.com/microsoft/vscode-languageserver-node/blob/main/testbed/server/src/server.ts

connection.onDefinition((params): DefinitionLink[] => {
	//check the line
	const f = getSkriptFileByUri(params.textDocument.uri);
	if (f) {
		const lines = f.document.getText().split('\n');
		const clickedLineText = lines[params.position.line];
		const indentationEndIndex = SkriptFile.getIndentationEndIndex(clickedLineText);
		if (params.position.character < indentationEndIndex) {
			return [];//clicked on indentation
		}

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

		//check for patterns
		const h = exactSection.lineInfo.get(params.position.line);
		if (h) {
			const relativePosition = params.position.character - indentationEndIndex;
			const match = h.getDeepestChildNodeAt(relativePosition);
			if (match.matchedPattern) {
				const pattern = match.matchedPattern;
				//const definitionLocation = pattern.definitionLocation;

				//const targetLineRange = {
				//	start: { line: definitionLocation.range.start.line, character: SkriptFile.getIndentationEndIndex(targetLine) },
				//	end: { line:  definitionLocation.range.end.line, character: targetLine.length }
				//};

				return [{
					targetUri: pattern.definitionLocation.uri,
					targetRange: pattern.definitionLocation.range,
					targetSelectionRange: pattern.definitionLocation.range,
					originSelectionRange: {
						start: { line: params.position.line, character: indentationEndIndex + match.start },
						end: { line: params.position.line, character: indentationEndIndex + match.end }
					}
				}];
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

connection.onDocumentSymbol((identifier) => {
	return [
		SymbolInformation.create('Item 1', SymbolKind.Function, {
			start: { line: 0, character: 0 },
			end: { line: 0, character: 10 }
		}, identifier.textDocument.uri),
		SymbolInformation.create('Item 2', SymbolKind.Function, {
			start: { line: 1, character: 0 },
			end: { line: 1, character: 10 }
		}, identifier.textDocument.uri)
	];
});

//function buildTokens(builder: SemanticTokensBuilder, document: TextDocument) {
//	const text = document.getText();
//	const regexp = /\w+/g;
//	let match: RegExpMatchArray | null;
//	let tokenCounter = 0;
//	let modifierCounter = 0;
//	while ((match = regexp.exec(text)) !== null && match.index !== undefined) {
//		const word = match[0];
//		const position = document.positionAt(match.index);
//		const tokenType = tokenCounter % TokenTypes.length;
//		const tokenModifier = 1 << modifierCounter % TokenModifiers.length;
//		builder.push(position.line, position.character, word.length, tokenType, tokenModifier);
//		//builder.push(
//		//	new Range(new Position(1, 1), new Position(1, 5)),
//		//	'class',
//		//	['declaration']);
//		//return;//TODO: remove again
//		tokenCounter++;
//		modifierCounter++;
//	}
//}

connection.languages.semanticTokens.on((params) => {
	//const settings = getDocumentSettings(params.textDocument.uri);
	const file = getSkriptFileByUri(params.textDocument.uri);
	if (file == undefined) {
		return { data: [] };
	}
	else {
		const result = file.builder.build();
		if (result.resultId != undefined) {
			//already tell the builder that next builds will be deltas
			file.builder.previousResult(result.resultId);
		}
		return result;
	}

	//const document = documents.get(params.textDocument.uri);
	//if (document === undefined) {
	//}
	//const builder = getTokenBuilder(document);
	//buildTokens(builder, document);
	//return builder.build();
});

connection.languages.semanticTokens.onDelta((params) => {
	const file = getSkriptFileByUri(params.textDocument.uri);
	if (file == undefined) {
		return { data: [] };
	}
	else {
		const result = file.builder.buildEdits();
		if (result.resultId != undefined) {
			//already tell the builder that next builds will be deltas
			file.builder.previousResult(result.resultId);
		}
		return result;
	}
	// const document = documents.get(params.textDocument.uri);
	// //return { edits: [] };
	// if (document === undefined) {
	// 	return { edits: [] };
	// }
	// const builder = getTokenBuilder(document);
	// builder.previousResult(params.previousResultId);
	// buildTokens(builder, document);
	// return builder.buildEdits();
});

connection.languages.semanticTokens.onRange((params) => {
	return { data: [] };
});

//connection.

connection.onCodeAction((params) => {
	const document = documents.get(params.textDocument.uri);
	const change: WorkspaceChange = new WorkspaceChange();
	const diagnosticsAssociated = params.context.diagnostics;
	if (diagnosticsAssociated.length > 0) {
		const currentDiagnostic = params.context.diagnostics[0];
		if (currentDiagnostic.code != undefined) {
			const codeAction: CodeAction = {
				title: 'Action not recognized',
				kind: CodeActionKind.QuickFix,
				data: params.textDocument.uri
			};
			if ((currentDiagnostic.code as string).startsWith("IntelliSkript->Indent")) {
				const data = currentDiagnostic.data;
				const indentString = data as string;
				//change.createFile(`${folder}/newFile.bat`, { overwrite: true });
				if (document) {
					const a = change.getTextEditChange(document);
					a.replace({
						start: {
							line: params.range.start.line,
							character: 0
						}, end:
						{
							line: params.range.start.line,
							character: SkriptFile.getIndentationEndIndex(document.getText().split("\n")[params.range.start.line])
						}
					}, indentString, ChangeAnnotation.create('Insert the expected amount of spaces and tabs', true));
				}
				//const b = change.getTextEditChange({ uri: `${folder}/newFile.bat`, version: null });
				//b.insert({ line: 0, character: 0 }, 'The initial content', ChangeAnnotation.create('Add additional content', true));

				codeAction.title = "Fix Indentation";
				codeAction.edit = change.edit;
				return [
					codeAction
				];
			}
			if ((currentDiagnostic.code as string).startsWith("IntelliSkript->Performance->Braces")) {


				//change.createFile(`${folder}/newFile.bat`, { overwrite: true });
				if (document) {
					const a = change.getTextEditChange(document);
					a.insert(
						currentDiagnostic.range.start, "(");
					a.insert(
						currentDiagnostic.range.end, ")",
						ChangeAnnotation.create('Insert braces to improve performance', true));
				}
				//const b = change.getTextEditChange({ uri: `${folder}/newFile.bat`, version: null });
				//b.insert({ line: 0, character: 0 }, 'The initial content', ChangeAnnotation.create('Add additional content', true));

				codeAction.isPreferred = true;
				codeAction.title = "Add Braces";
				codeAction.edit = change.edit;
				return [
					codeAction
				];
			}
		}
	}
	return [];
});

// This handler provides the initial list of the completion items.
//connection.onCompletion(
//	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
//		// The pass parameter contains the position of the text document in
//		// which code complete got requested. For the example we ignore this
//		// info and always provide the same completion items.
//		return [
//			{
//				label: 'TypeScript',
//				kind: CompletionItemKind.Text,
//				data: 1
//			},
//			{
//				label: 'JavaScript',
//				kind: CompletionItemKind.Text,
//				data: 2
//			}
//		];
//	}
//);

// This handler resolves additional information for the item selected in
// the completion list.
//connection.onCompletionResolve(
//	(item: CompletionItem): CompletionItem => {
//		if (item.data === 1) {
//			item.detail = 'TypeScript details';
//			item.documentation = 'TypeScript documentation';
//		} else if (item.data === 2) {
//			item.detail = 'JavaScript details';
//			item.documentation = 'JavaScript documentation';
//		}
//		return item;
//	}
//);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

