
//import * as vscode from 'vscode';
//
//export class SkriptDefinitionProvider implements vscode.DefinitionProvider {
//    public provideDefinition(
//        document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken):
//        Thenable<vscode.Location> {
//            const pos = new vscode.Location(document.uri, new vscode.Range(position, position.translate(2)));
//            return Promise.resolve(pos);
//            //token.isCancellationRequested = true;
//    }
//}