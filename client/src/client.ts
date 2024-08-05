import { ExtensionContext, extensions, RelativePattern, Uri, window, workspace } from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import { URI, Utils } from 'vscode-uri';

export async function activateClient(context: ExtensionContext, client: BaseLanguageClient) {
	await client.start();

	//make the server able to read and list files
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

	//this listener just sends the skript contents of an entire folder to the server
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
	const extensionPath = extensions.getExtension('JohnHeikens.intelliskript')?.extensionPath;
	//for debugger
	if (extensionPath)
		client.onRequest('custom/getStartData', async (_params: {}) => {
			return {
				addonPath: Utils.joinPath(URI.file(extensionPath), 'server', 'assets', 'addons').toString()
			};
		})
	// Listen for active text editor changes
	window.onDidChangeActiveTextEditor(editor => {
		if (editor && editor.document) {
			client.sendNotification('custom/onDidChangeActiveTextEditor', { uri: editor.document.uri.toString() });
		}
	});
	context.subscriptions.push(readFileListener, listFilesListener, getDocumentsListener);
	//window.showInformationMessage('client finished loading');
}