import { ChangeAnnotation, CodeAction, CodeActionKind, Connection, DefinitionLink, Diagnostic, DidChangeConfigurationNotification, DocumentFormattingParams, DocumentSelector, Hover, InitializeParams, InitializeResult, MarkupContent, MarkupKind, Range, RequestType, SemanticTokensClientCapabilities, SemanticTokensLegend, SemanticTokensRegistrationOptions, SemanticTokensRegistrationType, SymbolInformation, SymbolKind, TextDocumentPositionParams, TextDocuments, TextDocumentSyncKind, WorkspaceChange } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import * as IntelliSkriptConstants from './IntelliSkriptConstants';
import { PatternData } from './pattern/data/PatternData';
import { SkriptFolder } from './skript/folder-container/SkriptFolder';
import { SkriptWorkSpace } from './skript/folder-container/SkriptWorkSpace';
import { SkriptFile } from './skript/section/SkriptFile';
import { SkriptVariable } from './skript/storage/SkriptVariable';
import { IndentData } from './skript/validation/IndentData';
import { Sleep } from './Thread';
import { TokenModifiers } from './TokenModifiers';
import { TokenTypes } from './TokenTypes';

export class Server {
	constructor(connection: Connection) {
		// Create a simple text document manager.
		const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

		//workspaces

		let currentWorkSpace = new SkriptWorkSpace();

		//this function will unlock the workspace when it finished loading
		let unlockWorkSpace: () => void;

		let hasConfigurationCapability = false;
		let hasWorkspaceFolderCapability = true;
		//let hasDiagnosticRelatedInformationCapability = false;

		//function resolveUri(uri: string) : string
		//{
		//	return uri.substring('file:///'.length).replace('%3A', ':');
		//}

		let semanticTokensLegend: SemanticTokensLegend | undefined;
		function computeLegend(capability: SemanticTokensClientCapabilities): SemanticTokensLegend {

			const clientTokenTypes = new Set<string>(capability.tokenTypes);
			//const _clientTokenModifiers = new Set<string>(capability.tokenModifiers);

			const tokenTypes: string[] = [];
			//compute a token legend.
			//the client provides a list of token type strings it can understand. for example:
			//"string", "comment", "function". we need to 'translate' our tokens to these tokens.
			for (let i = 0; i < TokenTypes.length; i++) {
				const str = TokenTypes[i];
				if (clientTokenTypes.has(str)) {
					tokenTypes.push(str);
				} else {
					//for now, still add the token as-is
					tokenTypes.push(str);
				}
			}

			const tokenModifiers: string[] = [];
			for (let i = 0; i < TokenModifiers.length; i++) {
				tokenModifiers.push(TokenModifiers[i]);
				//const str = tokenModifiers[i];
				//if (clientTokenModifiers.has(str)) {
				//	tokenModifiers.push(str);
				//}
			}

			return { tokenTypes, tokenModifiers };
		}

		//const ReadFileRequest = new RequestType<{ uri: string }, string, void>('custom/readFile');
		//const ListFilesRequest = new RequestType<{ folderUri: string }, string[], void>('custom/listFiles');
		const getDocumentsRequest = new RequestType<{ folderUri: string }, { uri: string, content: string }[], void>('custom/getDocuments');
		const getStartDataRequest = new RequestType<{}, { addonPath: string }, void>('custom/getStartData');

		async function processWorkspaceFolder(folder: SkriptFolder) {
			const folderUri = folder.uri.toString();
			const documents = await connection.sendRequest(getDocumentsRequest, { folderUri: folderUri });

			//the client will send us a list of files. we will create the folders for them ourselves.
			for (const { uri, content } of documents) {

				//currentWorkSpace.validateTextDocument()
				//create folders until we're at the files level
				const parentFolder = folder.createFoldersForUri(URI.parse(uri));
				const document = TextDocument.create(uri, "skript", 0, content)
				parentFolder.addFile(new SkriptFile(parentFolder, document));
			}
		}

		connection.onInitialize(async (params: InitializeParams) => {
			//lock the workspace, so other functions can't do anything with it
			unlockWorkSpace = await currentWorkSpace.mutex.lock();

			//works for the client only
			//const myExtDir = vscode.extensions.getExtension ("JohnHeikens.IntelliSkript").extensionPath;
			if (IntelliSkriptConstants.IsDebugMode) {
				await Sleep(5000);//give the debugger time to start
			}

			//currentWorkSpaces.push(new SkriptWorkSpace());
			if (params.workspaceFolders != null) {
				console.log(params.workspaceFolders);
				for (const folder of params.workspaceFolders) {
					currentWorkSpace.children.push(new SkriptFolder(currentWorkSpace, URI.parse(folder.uri)));
					//const f = new SkriptFolder(currentWorkSpace, folder.uri);
					//currentWorkSpace.children.push(f);
					//currentWorkSpace.addFolder(f);
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
			//hasDiagnosticRelatedInformationCapability = !!(
			//	capabilities.textDocument &&
			//	capabilities.textDocument.publishDiagnostics &&
			//	capabilities.textDocument.publishDiagnostics.relatedInformation
			//);


			semanticTokensLegend = computeLegend(params.capabilities.textDocument!.semanticTokens!);
			//return result;
			return new Promise((resolve) => {
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
						hoverProvider: true,
						//completionProvider: {
						//	triggerCharacters: ['.'],
						//	allCommitCharacters: [';'],
						//	resolveProvider: false,
						//},
						//signatureHelpProvider: {
						//},
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
						documentFormattingProvider: true,
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
				}, 5000);
			});
		});

		connection.onInitialized(async () => {
			//the client is ready now.

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

			const settings = await getGlobalSettings() ?? defaultSettings;

			if (settings.UseColorTheme) {

				if (semanticTokensLegend) {
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
			}


			//add addon folder URI to addon folder
			const startData = await connection.sendRequest(getStartDataRequest, {});
			currentWorkSpace.addonFolder.uri = URI.parse(startData.addonPath);

			//loop over folders and read them
			for (const f of currentWorkSpace.children) {
				await processWorkspaceFolder(f);
			}

			unlockWorkSpace();
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

		// Cache the settings of all open documents
		const documentSettings: Map<string, Thenable<IntelliSkriptSettings>> = new Map();

		connection.onDocumentFormatting((params: DocumentFormattingParams) => {
			const { textDocument } = params;
			const file = currentWorkSpace.getSkriptFileByUri(URI.parse(textDocument.uri));
			if (file)
				return file.format();

			return [];
		});

		connection.onDidChangeConfiguration(() => {
			if (hasConfigurationCapability) {
				// Reset all cached document settings
				documentSettings.clear();
			} else {
			}

			// Revalidate all open text documents

			//for(document)
			//documents.all().forEach(validateTextDocument, true);
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


		// Only keep settings for open documents
		documents.onDidClose(e => {
			documentSettings.delete(e.document.uri);
			//todo: handle closing of files properly
			const looseFileIndex = currentWorkSpace.looseFiles.findIndex(file => file.document.uri == e.document.uri);
			if (looseFileIndex != -1) {
				currentWorkSpace.looseFiles[looseFileIndex].invalidate();
				currentWorkSpace.looseFiles.splice(looseFileIndex, 1);
			}
		});
		// Handle custom notification for active text editor change
		connection.onNotification('custom/onDidChangeActiveTextEditor', (params) => {
			//validate this file when switching to it
			//this boosts performance; this way, when you are editing a file, for each word you write, we can update the file.
			//their dependencies will only be updated when you switch to them.
			const document = documents.get(params.uri);
			if (document) {
				validateTextDocument(document, false);
			}
		});

		// The content of a text document has changed. This event is emitted
		// when the text document first opened or when its content has changed.
		documents.onDidChangeContent(change => {
			validateTextDocument(change.document);
		});

		async function validateTextDocument(textDocument: TextDocument, couldBeChanged: boolean = true): Promise<void> {
			const unlock = await currentWorkSpace.mutex.lock();
			currentWorkSpace.validateTextDocument(textDocument, couldBeChanged);

			const validatedDocument = currentWorkSpace.getSkriptFileByUri(URI.parse(textDocument.uri));
			unlock();
			if (validatedDocument) {
				const diagnostics: Diagnostic[] = validatedDocument.parseResult.diagnostics;

				// Send the computed diagnostics to VSCode.
				connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
			}
		}

		interface wordInfo {
			wordRange?: Range;
			//result: wordLookupResult;
			variable?: SkriptVariable;
			pattern?: PatternData;
		}

		function getWordInfo(params: TextDocumentPositionParams): wordInfo {

			//check the line
			const f = currentWorkSpace.getSkriptFileByUri(URI.parse(params.textDocument.uri));
			if (f) {
				const lines = f.document.getText().split('\n');
				const clickedLineText = lines[params.position.line];
				const indentationEndIndex = IndentData.getIndentationEndIndex(clickedLineText);
				if (params.position.character < indentationEndIndex) {
					return {
						variable: undefined
					};//clicked on indentation
				}

				const variableRegex = /\{(.*?)\}/g;
				let match;
				const exactSection = f.getExactSectionAtLine(params.position.line);
				while ((match = variableRegex.exec(clickedLineText))) {
					if (params.position.character >= match.index && params.position.character < match.index + match[0].length) {
						//clicked on a variable
						const variable = exactSection.getVariableByName(match[1]);


						if (variable != undefined) {
							return {
								variable: variable,
								wordRange: {
									start: { line: params.position.line, character: match.index },
									end: { line: params.position.line, character: match.index + match[0].length }
								}
							};
						}
					}
				}

				//check for patterns
				const patternReference = f.matches.getDeepestChildNodeAt(f.document.offsetAt(params.position));
				if (patternReference) {
					if (patternReference.matchedPattern) {
						const pattern = patternReference.matchedPattern;
						return {
							pattern: pattern,
							wordRange: {
								start: f.document.positionAt(patternReference.start),
								end: f.document.positionAt(patternReference.end)
							}
						};
					}
				}
			}
			//const currentDocumentText = params.textDocument.getText();
			return {
				variable: undefined
			};
		}

		connection.onHover((params: TextDocumentPositionParams): Hover | undefined => {
			const info = getWordInfo(params);
			let hoverContent: MarkupContent | undefined;
			if (info.variable) {
				const parameterStr = info.variable.isParameter ? '(parameter) ' : '';
				hoverContent = {
					kind: MarkupKind.Markdown,
					value: `${parameterStr}{**${info.variable.namePattern}**}\n\na variable named \`${info.variable.namePattern}\``
				};
			}
			else if (info.pattern) {
				function convert(toConvert: string): string {
					return toConvert.replace(/(\[|\]|\*)/g, '\\$1');
				}
				hoverContent = {
					kind: MarkupKind.Markdown,
					value: `**${convert(info.pattern.skriptPatternString)}**`
				};
				if (info.pattern.returnType.possibleTypes.length) {
					hoverContent.value += '\n\nreturns: ' + convert(info.pattern.returnType.possibleTypes[0].skriptPatternString);
				}
			}
			if (hoverContent) {
				return {
					contents: hoverContent
				};
			}
			return undefined;
		});

		//examples:
		//https://github.com/microsoft/vscode-languageserver-node/blob/main/testbed/server/src/server.ts

		connection.onDefinition((params): DefinitionLink[] => {
			const f = currentWorkSpace.getSkriptFileByUri(URI.parse(params.textDocument.uri));
			if (f) {
				const info = getWordInfo(params);
				if (info.variable) {

					//return all reference locations
					const targetLineIndex = info.variable.firstReferenceLocation.range.start.line;
					const targetLine = f.document.getText().split('\n')[targetLineIndex];


					const targetLineRange = {
						start: { line: targetLineIndex, character: IndentData.getIndentationEndIndex(targetLine) },
						end: { line: targetLineIndex, character: targetLine.length }
					};
					return [{
						targetUri: info.variable.firstReferenceLocation.uri,
						targetRange: targetLineRange,
						targetSelectionRange: info.variable.firstReferenceLocation.range,
						originSelectionRange: info.wordRange
					}];
				}
				else if (info.pattern) {

					return [{
						targetUri: info.pattern.definitionLocation.uri,
						targetRange: info.pattern.definitionLocation.range,
						targetSelectionRange: info.pattern.definitionLocation.range,
						originSelectionRange: info.wordRange
					}];
				}
			}
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

		//this file will build its tokens for the first time
		connection.languages.semanticTokens.on((params) => {
			//const settings = getDocumentSettings(params.textDocument.uri);
			const file = currentWorkSpace.getSkriptFileByUri(URI.parse(params.textDocument.uri));
			if (file == undefined) {
				//this happens in a changes preview. todo: add support for changes preview
				return { data: [] };
			}
			else {
				const result = file.builder.build();
				//if (result.resultId != undefined) {
				//	//already tell the builder that next builds will be deltas
				//	file.builder.previousResult(result.resultId);
				//}
				return result;
			}

		});

		//this file was modified while the tokens were already built
		connection.languages.semanticTokens.onDelta((params) => {
			const file = currentWorkSpace.getSkriptFileByUri(URI.parse(params.textDocument.uri));
			if (file == undefined) {
				return { edits: [] };
			}
			else {
				//const result = file.builder.build();
				file.builder.previousResult(params.previousResultId);
				const result = file.builder.buildEdits();
				//if (result.resultId != undefined) {
				//	//already tell the builder that next builds will be deltas
				//	file.builder.previousResult(result.resultId);
				//}
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

		connection.languages.semanticTokens.onRange(() => {
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
									character: IndentData.getIndentationEndIndex(document.getText().split("\n")[params.range.start.line])
								}
							}, indentString, ChangeAnnotation.create('Insert the expected amount of spaces and tabs', true));
						}

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
	}
}