import { SkriptTypeSection } from '../../skript/section/custom/SkriptTypeSection';
import { PatternData } from "../data/PatternData";

export class PatternTreeNode {
	//a list of children, mapped from a - z etc.
	//each child is just a normal node, for example the 'a' in 'say %'
	stringOrderedChildren: Map<string, PatternTreeNode> = new Map<string, PatternTreeNode>();

	//when the string doesn't continue, we will check the type nodes.
	typeOrderedChildren: Map<string, PatternTreeNode> = new Map<string, PatternTreeNode>();
    getTypeChild(type: SkriptTypeSection) {
        return this.typeOrderedChildren.get(type.getKey());
    }
	//otherNodes: PatternTreeNode[] = new Array<PatternTreeNode>();
	//when this can be an end node of a certain pattern, the end node is set. sometimes another pattern continues after this
	//for example:
	//say % <- end node
	//say % to % <- another end node
	endNode?: PatternData;
	patternKey?: string;

	//compare(_other: PatternTreeNode) {
	//	return false;
	//}

	constructor(patternKey?: string) {
		this.patternKey = patternKey;
	}


	clone(): PatternTreeNode {
		const clone = new PatternTreeNode();
		clone.patternKey = this.patternKey;
		clone.endNode = this.endNode;
		clone.stringOrderedChildren = new Map<string, PatternTreeNode>();
		for (const [key, value] of this.stringOrderedChildren) {
			//this method is definitely not optimized for memory usage as the nodes aren't linked anymore after this
			//am option would be to have an optimization function which links all identical nodes as references to a single node
			//the performance of this tree will increase the less memory it uses because the nodes will be placed in the L1 slots instead of the L2 slots for example
			clone.stringOrderedChildren.set(key, value.clone());
		}
		return clone;
	}
	merge(other: PatternTreeNode): void {
		for (const [key, value] of other.stringOrderedChildren) {
			const k = this.stringOrderedChildren.get(key);
			if (k) {
				k.merge(value);
			}
			else {
				this.stringOrderedChildren.set(key, value.clone());
			}
		}
		if (other.endNode) {
			this.endNode = other.endNode;
		}
	}
}
