import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { PatternTreeContainer } from '../../pattern/PatternTreeContainer';
import Mutex from '../../Thread';
import { SkriptFile } from '../section/SkriptFile';
import { SkriptFolder } from './SkriptFolder';
import { SkriptFolderContainer } from './SkriptFolderContainer';

export class SkriptWorkSpace extends SkriptFolderContainer {
	mutex = new Mutex();
	//the 'childsections' variable is not used here. TODO somehow merge the childsections and files variable
	//
	looseFiles: SkriptFile[] = [];

	//a workspace doesn't have a parent.
	override parent: undefined;
	addonFolder: SkriptFolder;
	//readAddonFiles() {
	//	this.addFolder(this.addonFolder);
	//}

	//the constructor will be used before the debugger is launched. caution!
	constructor() {
		super();
		//the addon folder will not use itself as parent pattern container, because when it calls getpatterncontainer(), this.addonFolder is still undefined
		this.children.push(this.addonFolder = new SkriptFolder(this, URI.from({ scheme: "internal" })));
	}

	getSkriptFileByUri(uri: URI): SkriptFile | undefined {
		const f = this.getFolderByUri(uri);
		if (f) {
			return f.getSkriptFileByUri(uri);
		}
		else {
			return this.looseFiles.find(val => val.uri.toString() == uri.toString()) ?? this.addonFolder.getSkriptFileByUri(uri);
		}
	}

	validateTextDocument(document: TextDocument, couldBeChanged: boolean = true): void {
		const uri: URI = URI.parse(document.uri);
		let file = this.getSkriptFileByUri(uri);
		if (!file) {
			const folder = this.getFolderByUri(uri);
			file = new SkriptFile(folder ?? this, document);
			if (folder) {
				folder.addFile(file);
			}
			else {
				this.looseFiles.push(file);
			}
		}
		else if (couldBeChanged && file.updateContent(document)) {
			// the document has changed
			// all files coming 'after' this file need to be updated. 
			// not only the previous dependents, because it could be that other files will get a dependency now
			let found = false;
			if (file.parent instanceof SkriptFolder) {
				for (const folderFile of file.parent.files) {
					if (folderFile == file) {
						found = true;
					}
					if (found) {
						folderFile.invalidate();
					}
				}
				//invalidate the folder and all subfolders
				file.parent.invalidate();

				if (file.parent == this.addonFolder) {
					//this is the addon folder, all files in the workspace depend on this
					for (const folder of this.children)
						folder.invalidate();
					for (const looseFile of this.looseFiles)
						looseFile.invalidate();

				}
			}
			else
				file.invalidate();
		}


		//use the token builder from the file
		if (!file.validated) {
			//revalidate all possibly invalidated dependencies

			//the workspace folder which is associated with this file
			const mainSubFolder = this.getSubFolderByUri(uri);

			if (mainSubFolder != this.addonFolder) {
				//first of all, validate the entire addon folder
				this.addonFolder.validate();
			}

			//when not, this file is a loose file
			if (file.parent instanceof SkriptFolder) {
				const folder = file.parent;

				let currentFolder = mainSubFolder;
				//recursively validate parent folders until we are at the file
				while (currentFolder && file.parent != currentFolder) {
					currentFolder.validate();
					currentFolder = currentFolder.getSubFolderByUri(uri);
				}
				//finally, validate the folder itself
				//regenerate patterns, but without those of the old file to avoid double definitions
				currentFolder?.validate(file);
			}
			else {
				file.validate();
			}
		}
	}
	override getPatternTree(): PatternTreeContainer | undefined {
		//get patterndata from the skript extension folder
		//don't call the getPatternData from the folder, because that will call this workspace again
		//todo: 
		//we're checking twice for the addon folder patterns when compiling the addon folder
		//it isn't that bad, because all files in the addon folder should be able to find their patterns
		return this.addonFolder?.patternContainer;
	}

	//override getVariableByName(name: string): SkriptVariable | undefined {
	//	for (const file of this.files) {
	//		const result = file.getVariableByName(name);
	//		if (result != undefined) return result;
	//	}
	//	return undefined;
	//}

}