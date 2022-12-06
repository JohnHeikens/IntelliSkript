import { SkriptFile } from './SkriptFile';
import { SkriptSectionGroup } from './SkriptSectionGroup';
import { SkriptVariable } from '../SkriptVariable';

export class SkriptWorkSpace extends SkriptSectionGroup {
	//the 'childsections' variable is not used here. TODO somehow merge the childsections and files variable
	files: SkriptFile[] = [];
	uri = "";
	constructor(workSpaceUri: string) {
		super();
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
		this.files.forEach((file, index) => {
			if (file.document.uri == uri) return index;
		});
		return undefined;
	}
	getSkriptFileByUri(uri: string): SkriptFile | undefined {
		const index = this.getSkriptFileIndexByUri(uri);
		return index ? this.files[index] : undefined;
	}
}