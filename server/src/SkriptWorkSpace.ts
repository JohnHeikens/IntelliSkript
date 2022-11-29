import { SkriptFile } from './SkriptFile';
import { SkriptSectionGroup } from './SkriptSectionGroup';
import { SkriptVariable } from './SkriptVariable';

export class SkriptWorkSpace extends SkriptSectionGroup{
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
	getSkriptFileByUri(uri: string): SkriptFile | undefined {
		for (const f of this.files) {
			if (f.document.uri == uri) {
				return f;
			}
		}
		return undefined;
	}
}