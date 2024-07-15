import path = require('path');
import { PatternData } from '../../pattern/data/PatternData';
import { SkriptPatternCall } from '../../pattern/SkriptPattern';
import { PatternResultProcessor } from '../../pattern/patternResultProcessor';
import { PatternTreeContainer } from '../../pattern/PatternTreeContainer';
import { SkriptFile } from '../section/SkriptFile';
import { SkriptFolderContainer } from './SkriptFolderContainer';
import { SkriptWorkSpace } from './SkriptWorkSpace';
import { MatchArray } from '../../pattern/match/matchArray';

export class SkriptFolder extends SkriptFolderContainer {
	uri = "";
	files: SkriptFile[] = [];
	override parent: SkriptFolderContainer;

	patterns: PatternTreeContainer = new PatternTreeContainer();
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
			this.patterns = new PatternTreeContainer();
			for (const file of this.files)
				//this way, a file won't know what is previous to it
				file.validated ?
					this.patterns.merge(file.patterns) :
					file.validate();
		}

	}

	constructor(parent: SkriptFolderContainer, uri: string) {
		super();
		this.parent = parent;
		this.uri = uri;
	}
	override getPatternData(testPattern: SkriptPatternCall): PatternData | undefined {
		return this.patterns.getPatternData(testPattern) ?? this.parent.getPatternData(testPattern);
	}
}