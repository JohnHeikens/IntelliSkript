import { URI } from 'vscode-uri';
import { addToUri, getRelativePathPart, URISeparator } from '../../file_system/fileFunctions';
import { PatternTreeContainer } from '../../pattern/PatternTreeContainer';
import { sortedIndex } from '../../SortedArray';
import { SkriptFile } from '../section/SkriptFile';
import { SkriptFolderContainer } from './SkriptFolderContainer';
import { SkriptWorkSpace } from './SkriptWorkSpace';

export class SkriptFolder extends SkriptFolderContainer {
	uri: URI;
	files: SkriptFile[] = [];
	override parent: SkriptFolderContainer;

	patternContainer: PatternTreeContainer;
	getSkriptFileIndexByUri(uri: URI): number {
		return sortedIndex(this.files, uri, (a, b) => a.document.uri < b.toString());
	}

	addFile(file: SkriptFile) {
		const index = this.getSkriptFileIndexByUri(file.uri);
		this.files.splice(index, 0, file);
	}

	getSkriptFileByUri(uri: URI): SkriptFile | undefined {
		if (!this.files.length) return undefined;
		const index = this.getSkriptFileIndexByUri(uri);
		const foundFile = this.files[index]
		return foundFile.document.uri == uri.toString() ? foundFile : undefined;
	}
	/**invalidate all files in this folder and child folders */
	invalidate() {
		for (const file of this.files)
			file.invalidate();

		for (const folder of this.children)
			folder.invalidate();

	}
	/**
	 * 
	 * @param endFile validate until this file is encountered
	 */
	validate(endFile?: SkriptFile) {
		//if the last file isn't validated, then we need to recalculate the patterns.
		//when a file invalidates, all files after it invalidate too.
		if (this.files.length == 0 || !this.files[this.files.length - 1].validated) {
			const isAddonFolder = this.parent instanceof SkriptWorkSpace && this.parent.addonFolder === this;
			this.patternContainer = new PatternTreeContainer(
				isAddonFolder ?
					undefined :
					this.parent.getPatternTree());
			for (const file of this.files) {
				//this way, a file won't know what is previous to it
				file.validated ?
					this.patternContainer.merge(file.patternContainer) :
					file.validate();

				if (file === endFile) //we don't need patterns after this
					return;
			}

		}
	}

	constructor(parent: SkriptFolderContainer, uri: URI) {
		super();
		this.parent = parent;
		this.uri = uri;
		this.patternContainer = new PatternTreeContainer(parent.getPatternTree());
	}
	override getPatternTree = () => this.patternContainer;

	createFoldersForUri(uri: URI): SkriptFolder {
		const child = this.getFolderByUri(uri);
		if (child) {
			return child.createFoldersForUri(uri);
		}
		else {
			const relativePath = getRelativePathPart(this.uri, uri);
			const offset = relativePath.search(URISeparator);
			if (offset == -1) {
				return this;
			}
			else {
				//TODO: make them insert alphabetically
				const newChild = new SkriptFolder(this, addToUri(this.uri, relativePath.substring(0, offset)));
				this.children.push(newChild);
				return newChild.createFoldersForUri(uri);
			}
		}
	}
}