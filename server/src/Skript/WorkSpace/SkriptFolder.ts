import path = require('path');
import { PatternTreeContainer } from '../PatternTreeContainer';
import { SkriptFile } from '../Section/SkriptFile';
import { SkriptSection } from '../Section/SkriptSection/SkriptSection';
import { SkriptSectionGroup } from '../Section/SkriptSectionGroup';
import { SkriptFolderContainer } from './SkriptFolderContainer';
import { SkriptPatternCall } from '../../Pattern/SkriptPattern';
import { PatternResultProcessor } from '../../Pattern/patternResultProcessor';
import { PatternData } from '../../Pattern/Data/PatternData';
import { SkriptContext } from '../SkriptContext';

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
	validate(){
		this.patterns = new PatternTreeContainer();
		for (const file of this.files) {
			//this way, a file won't know what is previous to it
			if (!file.validated) {
				file.validate();
			}
			else {
				this.patterns.merge(file.patterns);
			}
		}
	}

	constructor(parent: SkriptFolderContainer, uri: string) {
		super();
		this.parent = parent;
		this.uri = uri;
	}
	override getPatternData(testPattern: SkriptPatternCall, shouldContinue: PatternResultProcessor): PatternData | undefined {
		//get patterndata from the skript extension folder
		return this.patterns.getPatternData(testPattern, shouldContinue) ??
			this.parent.getPatternData(testPattern, shouldContinue);
	}
}