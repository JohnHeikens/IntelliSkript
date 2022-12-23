export class NestHierarchy<t extends NestHierarchy<t>> {
	start = 0;
	end = 0;

	children: t[] = [];
	//positions:number[] = [];
	//characters = "";
	getActiveNode(): t {
		if (this.children.length > 0 && (this.children[this.children.length - 1] as NestHierarchy<t>).end == 0) {
			return this.children[this.children.length - 1].getActiveNode();
		}
		return this as unknown as t;
	}


	constructor(start = 0, end = 0) {
		this.start = start;
		this.end = end;
	}

	getChildNodeStartAt(pos: number): t | undefined {
		for (const child of this.children) {
			if (child.start == pos) {
				return child;
			}
		}
	}

	getChildNodeAt(pos: number): t | undefined {
		for (const child of this.children) {
			if (pos >= child.start && pos < child.end) {
				return child;
			}
		}
		return undefined;
	}
	getMatchingClosingbrace(pos: number): number | undefined {
		const nodeStart = pos + 1;
		const childNode = this.getChildNodeAt(nodeStart);
		if (childNode) {
			if (childNode.start == nodeStart) {
				return childNode.end;
			}
			else {
				return childNode.getMatchingClosingbrace(pos);
			}
		}
		else {
			return undefined;
		}
	}
	getDeepestChildNodeAt(pos: number): t {
		const child = this.getChildNodeAt(pos);
		return child ? child.getDeepestChildNodeAt(pos) : this as unknown as t;
	}
}