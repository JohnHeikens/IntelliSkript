import path = require('path');
import { PatternTreeContainer } from '../../pattern/PatternTreeContainer';
import { SkriptFile } from '../section/SkriptFile';
import { SkriptFolderContainer } from './SkriptFolderContainer';
import { SkriptWorkSpace } from './SkriptWorkSpace';

export class SkriptFolder extends SkriptFolderContainer {
	uri = "";
	files: SkriptFile[] = [];
	override parent: SkriptFolderContainer;

	patternContainer: PatternTreeContainer;
	getSkriptFileIndexByUri(uri: string): number | undefined {
		for (let i = 0; i < this.files.length; i++) {
			if (this.files[i].document.uri == uri) return i;
		}
		return undefined;
	}
	getSkriptFileByUri(uri: string): SkriptFile | undefined {
		const index = this.getSkriptFileIndexByUri(uri);
		return index == undefined ? undefined : this.files[index];
	}
	/**invalidate all files in this folder and child folders */
	invalidate() {
		for (const file of this.files)
			file.invalidate();

		for (const folder of this.children)
			folder.invalidate();

	}
	validate() {
		//if the last file isn't validated, then we need to recalculate the patterns.
		//when a file invalidates, all files after it invalidate too.
		if (!this.files[this.files.length - 1].validated) {
			this.patternContainer = new PatternTreeContainer(
				this.parent instanceof SkriptWorkSpace && this.parent.addonFolder === this ? 
				undefined : this.parent.getPatternTree());
			for (const file of this.files)
				//this way, a file won't know what is previous to it
				file.validated ?
					this.patternContainer.merge(file.patternContainer) :
					file.validate();
		}

	}

	constructor(parent: SkriptFolderContainer, uri: string) {
		super();
		this.parent = parent;
		this.uri = uri;
		this.patternContainer = new PatternTreeContainer(parent.getPatternTree());
	}
	override getPatternTree = () => this.patternContainer;
}