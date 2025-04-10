import { NestHierarchy } from './NestHierarchy';

export class SkriptNestHierarchy extends NestHierarchy<SkriptNestHierarchy> {
	delimiter = '';

	override children: SkriptNestHierarchy[] = [];

	constructor(start: number, character: string, end = 0) {
		super(start, end);
		this.delimiter = character;
	}
	cloneWithOffset(offset: number): SkriptNestHierarchy {
		let clone: SkriptNestHierarchy = new SkriptNestHierarchy(this.start + offset, this.delimiter, this.end + offset);
		for (const child of this.children)
			clone.children.push(child.cloneWithOffset(offset));
		return clone;
	}
}