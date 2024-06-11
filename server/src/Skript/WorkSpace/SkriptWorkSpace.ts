import { TextDocument } from 'vscode-languageserver-textdocument';
import { PatternData } from "../../Pattern/Data/PatternData";
import { PatternResultProcessor } from "../../Pattern/patternResultProcessor";
import { PatternTreeContainer } from '../PatternTreeContainer';
import { SkriptContext } from '../SkriptContext';
import { SkriptFile } from '../Section/SkriptFile';
import { SkriptPatternCall } from '../../Pattern/SkriptPattern';
import path = require('path');
import { SkriptFolder } from './SkriptFolder';
import { SkriptFolderContainer } from './SkriptFolderContainer';
import { intelliSkriptAddonSkFilesDirectory } from '../Addon Parser/AddonParser';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { URI } from 'vscode-uri';

export class SkriptWorkSpace extends SkriptFolderContainer {
	//the 'childsections' variable is not used here. TODO somehow merge the childsections and files variable
	//
	looseFiles: SkriptFile[] = [];

	//a workspace doesn't have a parent.
	override parent: undefined;
	addonFolder: SkriptFolder;
	addFolder(folder: SkriptFolder) {
		//read synchronously, because we are in an async function already and the code after this depends on this
		const files = fs.readdirSync(fileURLToPath(folder.uri), undefined);//, (err: NodeJS.ErrnoException | null, files: string[]) => {
		//if (err) {
		//	console.error("Could not list the directory.", err);
		//	process.exit(1);
		//}
		const folderPath = fileURLToPath(folder.uri);

		files.forEach(file => {
			const completePath = path.join(folderPath, file);
			//convert path back to URI
			const fileUri = URI.file(completePath).toString();
			const document = TextDocument.create(fileUri, "sk", 0, fs.readFileSync(completePath, "utf8"));
			const skriptFile = new SkriptFile(folder, document);
			skriptFile.validate();
			folder.files.push(skriptFile);
		});
		//});
	}
	readAddonFiles() {
		this.addFolder(this.addonFolder);
	}

	//the constructor will be used before the debugger is launched. caution!
	constructor() {
		super();
		this.addonFolder = new SkriptFolder(this, URI.file(intelliSkriptAddonSkFilesDirectory).toString());
	}

	getSkriptFileByUri(uri: string): SkriptFile | undefined {
		const f = this.getFolderByUri(uri);
		if (f) {
			return f.getSkriptFileByUri(uri);
		}
		else {
			return this.looseFiles.find(val => val.document.uri == uri) ?? this.addonFolder.getSkriptFileByUri(uri);
		}
	}

	validateTextDocument(document: TextDocument): void {
		let file = this.getSkriptFileByUri(document.uri);
		if (!file) {
			const folder = this.getFolderByUri(document.uri);
			file = new SkriptFile(folder ?? this, document);
			if (folder) {
				folder.files.push(file);
				folder.files.sort((a, b) => a.document.uri > b.document.uri ? 1 : -1);
			}
			else {
				this.looseFiles.push(file);
			}
		}


		//use the token builder from the file
		if (!file.validated) {
			//validate addon folder
			this.addonFolder.validate();

			if ((file.parent instanceof SkriptFolder) && (file.parent != this.addonFolder)) {
				const folder = file.parent;

				//revalidate all possibly invalidated dependencies
				let currentFolder = this.getSubFolderByUri(document.uri);
				while (currentFolder instanceof SkriptFolder && file.parent != folder) {
					//validate parent folders recursively
					currentFolder.validate();
					//recursively validate until we are at the file
					currentFolder = currentFolder.getSubFolderByUri(document.uri);
				}
				//finally, validate the folder itself
				//regenerate patterns, but without those of the old file to avoid double definitions
				folder.patterns = new PatternTreeContainer();

				for (const folderFile of folder.files) {
					if (folderFile.validated) {
						folder.patterns.merge(folderFile.patterns);
					}
					else {
						folderFile.validate();
					}
					if (folderFile.document.uri == file.document.uri) {
						break;
					}
				}
			}
			else {
				file.validate();
			}
		}
		//}
		//else {
		//	//add document to skript workspace
		//	let f = new SkriptFile(this, context);
		//	//figure out where to put the file
		//	this.files.push(f);
		//	this.files.sort((a, b) => a.document.uri > b.document.uri ? 1 : -1);
		//	//const set = new Set(this.files);
		//	//set.add(f);
		//	//return Array.from(set).sort((a, b) => a - b);
		//	//this.files.push(new SkriptFile(this, context));
		//}
	}
	override getPatternData(testPattern: SkriptPatternCall, shouldContinue: PatternResultProcessor): PatternData | undefined {
		//get patterndata from the skript extension folder
		//don't call the getPatternData from the folder, because that will call this workspace again
		//todo: 
		//we're checking twice for the addon folder patterns when compiling the addon folder
		//it isn't that bad, because all files in the addon folder should be able to find their patterns
		return this.addonFolder.patterns.getPatternData(testPattern, shouldContinue);
	}

	//override getVariableByName(name: string): SkriptVariable | undefined {
	//	for (const file of this.files) {
	//		const result = file.getVariableByName(name);
	//		if (result != undefined) return result;
	//	}
	//	return undefined;
	//}

}
//workspace folders
//const currentWorkSpaces: SkriptWorkSpace[] = [];
//files without any workspace
//let looseWorkSpace: SkriptWorkSpace;//SkriptFile[] = [];