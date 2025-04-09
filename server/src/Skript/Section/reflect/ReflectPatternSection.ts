import { SkriptContext } from '../../validation/SkriptContext';
import { SkriptSection } from '../skriptSection/SkriptSection';
import { ReflectPatternContainerSection } from './ReflectPatternContainerSection';

export class ReflectPatternSection extends SkriptSection {

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
		(this.parent as ReflectPatternContainerSection).addPattern(context);
	}
}
//import { SkriptEventSection } from './SkriptEventSection';import { Hierarchy } from '../../../Hierarchy';