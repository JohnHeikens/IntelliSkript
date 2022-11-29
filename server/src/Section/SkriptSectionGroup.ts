import { SkriptSection } from './SkriptSection';
import { SkriptVariable } from '../SkriptVariable';

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
			if(line >= this.childSections[i].startLine && line < this.childSections[i].endLine)
			{
				return this.childSections[i];
			}
		}
		return undefined;
	}
	getVariableByName(name: string) : SkriptVariable | undefined{
		//throw new Error("skriptsectiongroup without derivation");
		return undefined;
	}
}