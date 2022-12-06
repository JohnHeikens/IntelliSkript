export class SkriptType {
	name = "";
	static types: SkriptType[] = [];
	constructor(name?: string) {
		this.name = name ? name : "";
		SkriptType.types.push(this);
	}
}