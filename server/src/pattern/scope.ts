import { SkriptTypeSection } from '../skript/section/custom/skript-type-section';
import { SkriptFunction } from "../skript/section/skript-function-section";
import { SkriptTypeState } from '../skript/storage/type/skript-type-state';
import { PatternData, TypeData } from "./data/pattern-data";
import { cloneProgress, MatchProgress } from './match/match-progress';
import { MatchResult } from './match/match-result';
import { PatternMatch } from './match/pattern-match';
import { PatternTree } from './pattern-tree';
import { PatternTreeNode } from './pattern-tree-node/pattern-tree-node';
import { RegExpNode } from "./pattern-tree-node/regexp-node";
import { canBeSubPattern, canHaveSubPattern, PatternType, SubstitutablePatterns } from './pattern-type';
import { SkriptPatternCall } from './skript-pattern';

/**a scope contains important things like pattern trees.
 * it can save local and global things, depending on the scope.
 */
export class Scope {
	/** a list of expression trees, this is to save time (to not recursively have to get patterns from parents or something). we will start at the top and end at this container.
	*/
	containersToTraverse: Scope[] = [];
	trees = new Array<PatternTree>(PatternType.count);
	functions = new Map<string, SkriptFunction>();
	constructor(parent?: Scope) {
		for (let i = 0; i < PatternType.count; i++) {
			this.trees[i] = new PatternTree();
		}
		if (parent)
			this.containersToTraverse.push(...parent.containersToTraverse);
		this.containersToTraverse.push(this);
	}

	testTypeNodes(testChild: (testChild: PatternTreeNode) => void, typeNodes: Map<string, PatternTreeNode>, possibleTypes: SkriptTypeState) {
		//make sure there are any types to check. this also makes sure that we can check for object, the base class of any type.
		if (!possibleTypes.possibleTypes.length) return;
		const testClass = (testKey: string): void => {
			const typeChild = typeNodes.get(testKey);
			if (typeChild) testChild(typeChild);
		}
		const testedTypes = new Set<string>();
		let testAllTypes = false;
		for (const type of possibleTypes.possibleTypes) {
			if (type.skriptPatternString == "unknown" || type.skriptPatternString == "object[s]") {
				//test all types
				testAllTypes = true;
			}
			else if (type.section) {
				if ((type.section as SkriptTypeSection).testBaseClasses(testClass, testedTypes)) return;
			}
		}
		//return testAllTypes;
		//const testAllTypes = possibleTypes.iterateBaseClasses(testClass, testedTypes);

		//when there is a possibility that the type is unknown, test all the possible types
		if (testAllTypes) {
			for (const [key, val] of typeNodes) {
				if (!testedTypes.has(key)) {
					testChild(val);
				}
			}
		}
		else if (!testedTypes.has("object[s]"))
			testClass("object[s]");

	}

	canSubstitute(progress: MatchProgress) {
		//when the pattern can be a subpattern and it substitutes to a pattern which can be a subpattern at the same node, infinite recursion can occur
		//wouldn't work when a pattern starts with a type literal for example
		return canHaveSubPattern(progress.patternType) &&
			(!canBeSubPattern(progress.patternType) || (progress.currentNode !== progress.rootNode));
	}

	/**
	 * take one step in the pattern tree
	 * @param progress the progress to step
	 * @returns next steps to take. may return multiple steps, when multiple traversal methods are available. for example, if a node has a string node, but also a type node.
	 */
	stepTreeNode(progress: MatchProgress): MatchProgress[] {
		//RULES
		//when a pattern is found, the function that found the end of the pattern adds the patternmatch
		//when calling recursively, never move the index back
		/**last nodes are checked first! */
		const nodesToCheck: MatchProgress[] = [];

		const pattern = progress.testPattern.pattern;

		//function isSeparator(checkIndex: number = progress.index): boolean {
		//	return / |'/.test(pattern[checkIndex]);
		//}

		//check if this end node 'works'
		const checkEndNode = (endNodeData: PatternData, checkIndex = progress.index) => {
			//we have a potential match!
			if (checkIndex == pattern.length && !progress.parent) {
				const fullMatch = new PatternMatch(progress.start, checkIndex, endNodeData)
				fullMatch.children = progress.subMatches;
				progress.result = new MatchResult(progress.testPattern, fullMatch);
				//this is the end of the pattern. now the full pattern has matched!
			}
			else if (canBeSubPattern(progress.patternType)) {
				//this part, a substitute, was parsed correctly. but now, we should continue the parent node.
				//we will iterate over all parent type nodes which accept an instance of the return value.
				//basically, we replaced the subpattern for a '%'
				//even when checkIndex == pattern.length, we should check base classes, because we didn't determine yet which type node it is
				//let fullMatch: MatchResult | undefined;

				const testParentNode = (parentProgress: MatchProgress) => {
					const childMatch = new PatternMatch(progress.start, checkIndex, endNodeData, progress.subMatches);
					const testTypeChild = (testChild: PatternTreeNode) => {
						//clone
						//add child match to parentprogress.submatches
						nodesToCheck.push({ ...cloneProgress(parentProgress), subMatches: parentProgress.subMatches.concat([childMatch]), currentNode: testChild, rootNode: testChild, index: checkIndex, argumentIndex: progress.argumentIndex });
					}
					if (progress.patternType == PatternType.expression) {
						this.testTypeNodes(testTypeChild, parentProgress.currentNode.instanceTypeChildren, endNodeData.returnType);
					}
					else {//we don't have to check for both, as all statictypechildren also exist on instancetypechildren
						this.testTypeNodes(testTypeChild, parentProgress.currentNode.staticTypeChildren, new SkriptTypeState(endNodeData as TypeData));
					}

					//if (fullMatch) {
					//	//add the submatch to its parent match
					//	const parentMatch = fullMatch.fullMatch.getDeepestChildNodeAt(progress.start);
					//	//we know for sure that each match we will add, is further to the start. so we can add matches to the start of the deepest child node.
					//	parentMatch.children.unshift(childMatch);
					//	return true;
					//}
				}

				if (progress.parent) {
					//maybe this is a submatch of a higher level match.
					testParentNode(progress.parent);
				}
				if (this.canSubstitute(progress)) {
					//maybe this is the first submatch of a higher level match.
					for (const container of this.containersToTraverse) {
						const root = container.trees[PatternType.expression].compileAndGetRoot();
						const parentProgress: MatchProgress = {
							...progress,
							//the old parent node becomes 'grandparent'
							parent: progress.parent,
							rootNode: root,
							currentNode: root,
							//the pattern type has to be expression, as that's the only pattern type which can substitute and be a substitute
							//we don't have to test for type, because type can't substitute.
							//we don't have to test for event, because we'd already have tested that as progress.parent.
							patternType: PatternType.expression,
							//don't add this match yet, it's done in the testParentNode function
							subMatches: []
						};
						//create a new parent node, which replaces the current node. the current node becomes a child.
						testParentNode(parentProgress);
					}
				}
				//when no full match is found, we just continue
			}
			return undefined;
		}

		//check if this pattern matches a regex pattern
		if (progress.currentNode == progress.rootNode && progress.patternType == PatternType.expression && /[0-9-]/.test(pattern[progress.index])) {
			for (let [key, child] of progress.currentNode.regExpOrderedChildren) {
				let childRegexp = (child as RegExpNode).regExp;
				//this is a number
				//const numberNode = progress.currentNode.regExpOrderedChildren[0] as RegExpNode;
				let matchArray = childRegexp.exec(pattern.substring(progress.index));
				//reset
				childRegexp.lastIndex = 0;
				if (matchArray) {
					nodesToCheck.push({ ...cloneProgress(progress), currentNode: child, index: progress.index + matchArray[0].length });
				}
			}
		}
		//multiple recursive matches may end at the same time
		//for example:
		//set {_var} to 3 + 4
		//% + % and set % to % both end at the same time
		for (const endNodeData of progress.currentNode.patternsEndedHere) {
			checkEndNode(endNodeData);
		}
		if (progress.index < pattern.length) {
			//maybe the current part of the pattern belongs to a submatch?
			const hasValidInstanceNodes = progress.currentNode.instanceTypeChildren.size > 0;
			const hasValidStaticNodes = progress.currentNode.staticTypeChildren.size > 0;

			//all possibilities have been tested, but there haven't been any children who fit this pattern. we need to submatch.
			//we will try finding a pattern from the expression trees which returns an instance of the expected type.

			//infinite recursion happens when the currentnode is root
			if (this.canSubstitute(progress)) {
				for (const substitutablePatternType of SubstitutablePatterns) {
					if (substitutablePatternType == PatternType.type ? hasValidStaticNodes : hasValidInstanceNodes) {
						for (const container of this.containersToTraverse) {
							//clone
							const root = container.trees[substitutablePatternType].compileAndGetRoot();
							nodesToCheck.push({ ...progress, start: progress.index, parent: { ...cloneProgress(progress) }, currentNode: root, rootNode: root, patternType: substitutablePatternType });
						}
					}
				}
			}
			//no match stopped at this position
			//the pattern call is shorter than the patterns



			const currentChar = pattern[progress.index];
			if (progress.currentNode.instanceTypeChildren.size) {
				let newIndex = progress.index;
				let newArgumentIndex = progress.argumentIndex;
				const testClass = (typeChild: PatternTreeNode): void => {
					if (typeChild) {
						nodesToCheck.push({ ...cloneProgress(progress), currentNode: typeChild, rootNode: progress.currentNode, index: newIndex, argumentIndex: newArgumentIndex });
					}
				}

				if (currentChar == '%' &&
					//for more security. for example, when someone put a '%' in the pattern
					progress.argumentIndex < progress.testPattern.expressionArguments.length) {
					//test all base classes recursively
					const currentArgument = progress.testPattern.expressionArguments[progress.argumentIndex];
					newIndex++;
					newArgumentIndex++;
					this.testTypeNodes(testClass, progress.currentNode.instanceTypeChildren, currentArgument);
				}
			}
			const charChild = progress.currentNode.stringOrderedChildren.get(currentChar);
			if (charChild) {
				//check the normal path (just traversing the tree based on charachters we encounter) first.
				nodesToCheck.push({ ...cloneProgress(progress), currentNode: charChild, index: progress.index + 1 });
			}
		}
		//reverse order, because the last elements will be checked first
		return nodesToCheck;
	}


	/**
	 * this function works as follows:
	 * it tries to find a pattern which matches the text. it's recursive in two ways, like this:
	 * imagine we have the pattern:
	 * 'send 2 * 2 to the player'
	 * it will parse it like this:
	 * send % to %
	 * match the first %:
	 * 2 * 2 to the player
	 * match the first %
	 * % -> number, end of subsubmatch
	 * % * 2 to the player
	 * match % * %
	 * first match found, match second %
	 * %-> number, end of subsubsubmatch
	 * end of subsubmatch (% * %)
	 * continue match:
	 * send % to %
	 * match second %
	 * the player
	 * end of submatch
	 * end of match
	 * @param testPattern
	 * @param currentNode
	 * @param index
	 * @param argumentIndex
	 * @param parentMatchNode
	 * @returns
	 */
	getMatchingPatternPart(startNodes: MatchProgress[]): MatchResult | undefined {
		interface richProgress {
			progress: MatchProgress, nodesPassed: PatternTreeNode[]
		};
		let nextStepsToTake: (richProgress | undefined)[] = startNodes.map((node) => { return { progress: node, nodesPassed: [node.currentNode] } });
		let currentProgress: richProgress | undefined;
		//the last array elements will be processed first
		while (currentProgress = nextStepsToTake.pop()) {
			const nextSteps = this.stepTreeNode(currentProgress.progress);
			if (currentProgress.progress.result) {
				currentProgress.progress.result.nodesPassed = currentProgress.nodesPassed;
				//TODO: create matchresult
				return currentProgress.progress.result;
			}

			nextStepsToTake.push(...nextSteps.map((value) => { return { progress: value, nodesPassed: [...(currentProgress as richProgress).nodesPassed, value.currentNode] } }));
		}
		//we tested all possibilities without matching a pattern
		return undefined;
	}

	getStartNodes(patternCall: SkriptPatternCall): MatchProgress[] {
		const startNodes = [];

		//loop all trees we can traverse
		for (const container of this.containersToTraverse) {
			for (const patternType of patternCall.patternTypes) {
				const tree = container.trees[patternType];
				const root = tree.compileAndGetRoot();
				startNodes.push({
					testPattern: patternCall,
					start: 0,
					index: 0,
					argumentIndex: 0,
					currentNode: root,
					rootNode: root,
					patternType: patternType,
					subMatches: []
				});
			}
		}
		return startNodes;
	}
	//the tree should be compiled before this method is called
	getPatternMatch(testPattern: SkriptPatternCall): MatchResult | undefined {
		return this.getMatchingPatternPart(this.getStartNodes(testPattern));
	}

	getMatchingFunction(name: string): SkriptFunction | undefined {
		let f: SkriptFunction | undefined = undefined;
		for (const container of this.containersToTraverse) {
			if (f = container.functions.get(name)) {
				return f;
			}
		}
		return undefined;
	}

	addPattern(pattern: PatternData): void {
		this.trees[pattern.patternType].addPattern(pattern);
	}

	//add patterns and functions of other container to this container
	merge(other: Scope): void {
		for (let i = 0; i < PatternType.count; i++) {
			this.trees[i].merge(other.trees[i]);
		}
		this.functions = new Map([...this.functions.entries(), ...other.functions.entries()]);
	}
}