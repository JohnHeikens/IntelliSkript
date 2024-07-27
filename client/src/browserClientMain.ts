/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, RelativePattern, Uri, workspace } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';

import { LanguageClient } from 'vscode-languageclient/browser';
import { Buffer } from 'buffer';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';

let client: LanguageClient | undefined;
// this method is called when vs code is activated
export async function activate(context: ExtensionContext) {

	//console.log('lsp-web-extension-sample activated!');

	/*
	 * all except the code to create the language client in not browser specific
	 * and could be shared with a regular (Node) extension
	 */
	const documentSelector = [{ language: 'skript' }];

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		documentSelector,
		synchronize: {},
		initializationOptions: {}
	};

	client = createWorkerLanguageClient(context, clientOptions);
	await client.start();

	//make the server able to read files
	const readFileListener = client.onRequest('custom/readFile', async (params: { uri: string }) => {
		const uri = Uri.parse(params.uri);
		const fileContent = await workspace.fs.readFile(uri);
		return Buffer.from(fileContent).toString('utf8');
	})
	const listFilesListener = client.onRequest('custom/listFiles', async (params: { folderUri: string }) => {
		const folderUri = Uri.parse(params.folderUri);
		const files = await workspace.findFiles(new RelativePattern(folderUri, '**/*'), '**/node_modules/**');
		return files.map(file => file.toString());
	})

	const getDocumentsListener = client.onRequest('custom/getDocuments', async (params: { folderUri: string }) => {
		const folderUri = Uri.parse(params.folderUri);
		const files = await workspace.findFiles(new RelativePattern(folderUri, '**/*.sk'));

		//read all files at once:
		return Promise.all(
			files.map(
				async file => ({
					uri: file.toString(),
					//convert bytes to string
					content: Buffer.from(await workspace.fs.readFile(file)).toString('utf8')
				})));
	})
	const extensionPath = vscode.extensions.getExtension('JohnHeikens.intelliskript')?.extensionPath;
	const startDataListener = client.onRequest('custom/getStartData', async (params: {}) => {
		return {
			addonPath: Utils.joinPath(URI.file(extensionPath), 'server', 'dist', 'assets', 'addons').toString()
		};
	})
	// Listen for active text editor changes
	vscode.window.onDidChangeActiveTextEditor(editor => {
	   if (editor && editor.document) {
		   client.sendNotification('custom/onDidChangeActiveTextEditor', { uri: editor.document.uri.toString() });
	   }
   });


	context.subscriptions.push(readFileListener, listFilesListener, getDocumentsListener);
	console.log('lsp-web-extension-sample server is ready');
}

export async function deactivate(): Promise<void> {
	if (client !== undefined) {
		await client.stop();
	}
}

function createWorkerLanguageClient(context: ExtensionContext, clientOptions: LanguageClientOptions) {
	// Create a worker. The worker main file implements the language server.
	const serverMain = Uri.joinPath(context.extensionUri, 'server/dist/browserServerMain.js');
	const worker = new Worker(serverMain.toString(true));

	// create the language server client to communicate with the server running in the worker
	return new LanguageClient('lsp-web-extension-sample', 'LSP Web Extension Sample', clientOptions, worker);
}
