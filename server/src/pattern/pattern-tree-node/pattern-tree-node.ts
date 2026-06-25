import { PatternData } from '../data/pattern-data';

export class PatternTreeNode {
	parentGroups: Map<string, PatternTreeNode>[] = [];
	//a list of children, mapped from a - z etc.
	/**each child is just a normal node, for example the 'a' in 'say %'*/
	stringOrderedChildren = new Map<string, PatternTreeNode>();

	//when the string doesn't continue, we will check the type nodes.
	/**children which are instances: 'the player', 'a creeper'*/
	instanceTypeChildren = new Map<string, PatternTreeNode>();
	/**children which are static 'player', 'creeper'*/
	staticTypeChildren = new Map<string, PatternTreeNode>();

	/**could as well be an array, but to make things more simple, lets keep the same data type */
	regExpOrderedChildren = new Map<string, PatternTreeNode>();
	//otherNodes: PatternTreeNode[] = new Array<PatternTreeNode>();
	//when this can be an end node of a certain pattern, the end node is set. sometimes another pattern continues after this
	//for example:
	//say % <- end node
	//say % to % <- another end node
	patternsEndedHere: PatternData[] = [];

	//compare(_other: PatternTreeNode) {
	//	return false;
	//}

	// cloning and merging aren't implemented anymore, because when a pattern clones, the efficiency is gone because nodes aren't linked anymore.
	// so all options would be cloned separately.
	// we'll just copy the pattern datas instead when merging the pattern trees.

	constructor() {
	}
}
