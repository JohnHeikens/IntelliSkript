import { SkriptSection } from './SkriptSection';
import { SkriptVariable } from './SkriptVariable';

export class SkriptSectionGroup{
	parent: SkriptSectionGroup | undefined;
	childSections: SkriptSection[] = [];
	constructor(parent: SkriptSection | undefined = undefined) {
		this.parent = parent;
	}
	getChildSectionAtLine(line: number): SkriptSection | undefined
	{
		for(let i = 0; i < this.childSections.length; i++) 
		{
			if(this.childSections[i].startLine > line)
			{
				return i > 0 ? this.childSections[i - 1] : undefined;
			}
		}
		return this.childSections.length > 0 ? this.childSections[0] : undefined;
	}
	getVariableByName(name: string) : SkriptVariable | undefined{
		//throw new Error("skriptsectiongroup without derivation");
		return undefined;
	}
}