import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection';
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';
import assert from 'assert';
import { SkriptPattern } from '../../SkriptPattern';

export class SkriptPatternSection extends SkriptSection {

	override processLine(context: SkriptContext): void {
		assert(this.parent instanceof SkriptPatternContainerSection);
		this.parent.patterns.push( new SkriptPattern( context));
	}
}