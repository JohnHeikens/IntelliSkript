import { SkriptContext } from '../../validation/SkriptContext';
import { SkriptSection } from '../skriptSection/SkriptSection';
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';

export class SkriptPatternSection extends SkriptSection {

	//highLightHierarchically (context: SkriptContext, Hierarchy: SkriptNestHierarchy) : void {
	//	for(let i = 0; i < Hierarchy.children.length; i++) {
	//		const child = Hierarchy.children[i];
	//		if (child.character == '%')
	//		{
	//			context.addToken(TokenTypes.type, child.start, child.end - child.start);
	//		}
	//		else {
	//			this.highLightHierarchically(context, child);
	//		}
	//	}
	//}

	override processLine(context: SkriptContext): void {
		(this.parent as SkriptPatternContainerSection).addPattern(context);
	}
}
//import { SkriptEventSection } from './SkriptEventSection';import { Hierarchy } from '../../../Hierarchy';