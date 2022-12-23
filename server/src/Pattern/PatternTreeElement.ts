import { SkriptNestHierarchy } from '../Nesting/SkriptNestHierarchy';
import { PatternData } from "./PatternData";
import { removeDuplicates } from "./removeDuplicates";


export class PatternTreeElement {
	children: Map<string, PatternTreeElement> = new Map<string, PatternTreeElement>();
	endNode?: PatternData;
	patternKey?: string;
	constructor(patternKey?: string) {
		this.patternKey = patternKey;
	}

	getMatchingPatternPart(pattern: string, index: number): PatternData | undefined {
		if (this.endNode) { // && (index == (pattern.length))) {
			if (index == pattern.length || (pattern[index + 1] == ' ')) {
				return this.endNode;
			}
		}
		const currentChar = pattern[index];
		const charChild = this.children.get(currentChar);
		if (charChild) {
			const charChildMatchResult = charChild.getMatchingPatternPart(pattern, index + 1);
			if (charChildMatchResult)
				return charChildMatchResult;
		}
		return undefined;
	}

	//returns endnodes of the pattern parts
	addPatternPart(pattern: string, currentElements: PatternTreeElement[], Hierarchy: SkriptNestHierarchy): PatternTreeElement[] {
		if (Hierarchy.children.length && Hierarchy.children[0].character == '|') {
			let allOptionEnds: PatternTreeElement[] = [];
			for (const child of Hierarchy.children) {
				const optionEnds = this.addPatternPart(pattern, currentElements, child);
				allOptionEnds = allOptionEnds.concat(optionEnds);
			}
			return allOptionEnds;
		}
		for (let i = Hierarchy.start; i < Hierarchy.end; i++) {
			let newElements: PatternTreeElement[] | undefined;
			const char = pattern[i];
			if (char == '(') {
				//required segment, needed for pipes. for example, a(b|c) != ab|c
				const node = Hierarchy.getChildNodeStartAt(i + 1);
				if (node != undefined) {
					const optionEnds = this.addPatternPart(pattern, currentElements, node);
					if (pattern[node.end + 1] == '?') {
						//optional segment
						newElements = currentElements.concat(optionEnds);
						i = node.end + 1; //+1 but the +1 gets added in the loop already
					}
					else {
						newElements = optionEnds;
						i = node.end; //+1 but the +1 gets added in the loop already
					}
				}
			}
			else {
				newElements = [];
				let treeElem = undefined;
				for (let j = 0; j < currentElements.length; j++) {
					if ((char == ' ') && ((currentElements[j].patternKey == ' '))) {
						//no double spaces
						newElements.push(currentElements[j]);
					}
					else {
						const currentTreeElem = currentElements[j].children.get(char);
						if (currentTreeElem == undefined) {
							if (treeElem == undefined) {
								treeElem = new PatternTreeElement(char);
								newElements.push(treeElem);
							}
							currentElements[j].children.set(char, treeElem);
						}
						else {
							newElements.push(currentTreeElem);
						}
					}
				}
			}
			if (newElements) {
				currentElements = removeDuplicates(newElements);
			}
		}
		return currentElements;
	}
	clone(): PatternTreeElement {
		const clone = new PatternTreeElement();
		clone.patternKey = this.patternKey;
		clone.endNode = this.endNode;
		clone.children = new Map<string, PatternTreeElement>();
		for (const [key, value] of this.children) {
			//this method is definitely not optimized for memory usage as the nodes aren't linked anymore after this
			//am option would be to have an optimization function which links all identical nodes as references to a single node
			//the performance of this tree will increase the less memory it uses because the nodes will be placed in the L1 slots instead of the L2 slots for example
			clone.children.set(key, value.clone());
		}
		return clone;
	}
	merge(other: PatternTreeElement): void {
		for (const [key, value] of other.children) {
			const k = this.children.get(key);
			if (k) {
				k.merge(value);
			}
			else {
				this.children.set(key, value.clone());
			}
		}
		if (other.endNode) {
			this.endNode = other.endNode;
		}
	}
}
