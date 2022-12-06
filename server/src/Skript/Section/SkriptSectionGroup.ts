import { SkriptSection } from './SkriptSection';
import { SkriptVariable } from '../SkriptVariable';
import { Hierarchy } from '../../Hierarchy';

export class SkriptSectionGroup extends Hierarchy<SkriptSectionGroup> {
	override children: SkriptSection[] = [];
	constructor(parent?: SkriptSection) {
		super(parent);
	}
	getChildSectionAtLine(line: number): SkriptSection | undefined
	{
		for(let i = 0; i < this.children.length; i++) 
		{
			if(line >= this.children[i].startLine && line < this.children[i].endLine)
			{
				return this.children[i];
			}
		}
		return undefined;
	}
	getVariableByName(name: string) : SkriptVariable | undefined{
		//throw new Error("skriptsectiongroup without derivation");
		return undefined;
	}
}