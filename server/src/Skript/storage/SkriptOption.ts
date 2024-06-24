export class SkriptOption {
	name: string;
	value: string;
	constructor(name: string, value: string) {
		this.name = "{@" + name + "}";
		this.value = value;
	}
}