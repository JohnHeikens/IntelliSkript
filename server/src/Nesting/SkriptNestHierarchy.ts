import { NestHierarchy } from './NestHierarchy';

export class SkriptNestHierarchy extends NestHierarchy<SkriptNestHierarchy> {
	character = '';

	override children: SkriptNestHierarchy[] = [];

	constructor(start: number, character: string, end = 0) {
		super(start, end);
		this.character = character;
	}
}