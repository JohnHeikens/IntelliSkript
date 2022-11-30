
export class SkriptNestHierarchy {
	start = 0;
	end = 0;
	charachter = '';

	children: SkriptNestHierarchy[] = [];
	//positions:number[] = [];
	//charachters = "";
	getActiveNode(): SkriptNestHierarchy {
		if (this.children.length > 0 && this.children[this.children.length - 1].end == 0) {
			return this.children[this.children.length - 1].getActiveNode();
		}
		return this;
	}


	constructor(start: number, charachter: string) {
		this.start = start;
		this.charachter = charachter;
	}

	getChildNodeAt(pos: number): SkriptNestHierarchy | undefined{
		for(const child of this.children) {
			if(pos >= child.start && pos < child.end){
				return child;
			} 
		}
		return undefined;
	}
	getMatchingClosingbrace(pos: number): number | undefined {
		const childNode = this.getChildNodeAt(pos);
		if(childNode){
			if(childNode.start == pos){
				return childNode.end;
			}
			else{
				return childNode.getMatchingClosingbrace(pos);
			}
		}
		else{
			return undefined;
		}
	}
}