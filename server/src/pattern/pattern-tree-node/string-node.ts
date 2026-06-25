import { PatternTreeNode } from "./pattern-tree-node";

export class StringNode extends PatternTreeNode {
	patternKey?: string;

	constructor(patternKey?: string) {
		super();
		this.patternKey = patternKey;
	}
}