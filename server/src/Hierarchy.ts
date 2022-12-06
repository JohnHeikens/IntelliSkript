export class Hierarchy<t>{
	children: t[] = [];
	parent?: t;
	constructor(parent?: t, children?: t[]) {
		this.parent = parent;
		if (children) {
			this.children = children;
		}
	}
}