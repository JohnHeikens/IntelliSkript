import * as assert from 'assert';
import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection/SkriptSection';

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
		//context.createHierarchy(false);
		//this.highLightHierarchically(context, context.hierarchy);
		this.parent.addPattern(context);
		//if(this.parent instanceof SkriptEventSection){
		//	context.currentSkriptFile?.workSpace.eventPatterns.addPattern(context, this.parent);
		//}
		//else{
		//	context.currentSkriptFile?.workSpace.effectPatterns.addPattern(context, this.parent);
		//}
		//context.currentSkriptFile?.workSpace.effectPatterns.addPattern(context, this.parent);
	}
}
//import { SkriptEventSection } from './SkriptEventSection';import { Hierarchy } from '../../../Hierarchy';
import { SkriptNestHierarchy } from '../../../Nesting/SkriptNestHierarchy';
import { TokenTypes } from '../../../TokenTypes';
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';

