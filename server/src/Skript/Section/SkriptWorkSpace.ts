import { SkriptFile } from './SkriptFile';
import { SkriptSectionGroup } from './SkriptSectionGroup';
import { SkriptVariable } from '../SkriptVariable';
import { PatternTree } from '../../PatternTree';

export class SkriptWorkSpace extends SkriptSectionGroup {
	//the 'childsections' variable is not used here. TODO somehow merge the childsections and files variable
	files: SkriptFile[] = [];
	uri? = "";
	effectPatterns: PatternTree = new PatternTree();
	eventPatterns: PatternTree = new PatternTree();
	override parent?: SkriptWorkSpace | undefined;

	constructor(parent? : SkriptWorkSpace, workSpaceUri?: string) {
		super();
		this.parent = parent;
		this.uri = workSpaceUri;
	}

	override getVariableByName(name: string): SkriptVariable | undefined {
		for (const file of this.files) {
			const result = file.getVariableByName(name);
			if (result != undefined) return result;
		}
		return undefined;
	}
	getSkriptFileIndexByUri(uri: string): number | undefined {
		for (let i = 0; i < this.files.length; i++) {
			if(this.files[i].document.uri == uri) return i;
		}
		return undefined;
	}
	getSkriptFileByUri(uri: string): SkriptFile | undefined {
		const index = this.getSkriptFileIndexByUri(uri);
		return index == undefined ? undefined : this.files[index];
	}
}