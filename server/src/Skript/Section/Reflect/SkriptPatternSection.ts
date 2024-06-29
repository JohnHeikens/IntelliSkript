import * as assert from 'assert';
import { SkriptContext } from '../../validation/SkriptContext';
import { SkriptSection } from '../skriptSection/SkriptSection';

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
		assert(this.parent instanceof SkriptPatternContainerSection);
		this.parent.addPattern(context);
	}
}
//import { SkriptEventSection } from './SkriptEventSection';import { Hierarchy } from '../../../Hierarchy';
import { SkriptNestHierarchy } from '../../../nesting/SkriptNestHierarchy';
import { TokenTypes } from '../../../TokenTypes';
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';

