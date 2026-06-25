import { PatternTreeNode } from "./pattern-tree-node";

export class RegExpNode extends PatternTreeNode{
	regExp : RegExp;
	constructor(regExp: RegExp){
		super();
		this.regExp = regExp;
	}
}