/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as vscode from 'vscode';


import { workspace, ExtensionContext } from 'vscode';
//import { SkriptDefinitionProvider } from './SkriptDefinitionProvider';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    //console.log('Extension "yourExtension" is now active!');
	//vscode.window.showInformationMessage('IntelliSkript has been activated');
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [
			//{
			//	scheme: 'file',
			//	language: 'skript'
			//}
			//https://github.com/Microsoft/vscode-languageserver-node/issues/175
			{
				scheme: 'file',
				pattern: '**/*.sk'// pattern: path.join(vscode.workspace.rootPath, "/dub.{sdl,json")
			}
		],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'intelliSkript',
		'IntelliSense for Skript',
		serverOptions,
		clientOptions
	);
	
    //context.subscriptions.push(
    //    vscode.languages.registerDefinitionProvider(
    //        ".sk", new SkriptDefinitionProvider()));

	// Start the client. This will also launch the server
	client.start();
	
	 // Listen for active text editor changes
	 vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document) {
            client.sendNotification('custom/onDidChangeActiveTextEditor', { uri: editor.document.uri.toString() });
        }
    });
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
