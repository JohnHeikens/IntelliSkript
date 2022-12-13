import * as assert from 'assert';
import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection';

export class SkriptPatternSection extends SkriptSection {

	override processLine(context: SkriptContext): void {
		assert(this.parent instanceof SkriptPatternContainerSection);
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
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';
//import { SkriptEventSection } from './SkriptEventSection';