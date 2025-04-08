import { PatternData } from "../pattern/data/PatternData";
import { PatternMatcher } from '../pattern/PatternMatcher';
import { PatternTree } from '../pattern/PatternTree';
import { canBeSubPattern, PatternType } from '../pattern/PatternType';
import { SkriptPatternCall } from '../pattern/SkriptPattern';
import { SkriptTypeSection } from '../skript/section/custom/SkriptTypeSection';
import { SkriptFunction } from "../skript/section/SkriptFunctionSection";
import { SkriptTypeState } from '../skript/storage/type/SkriptTypeState';
import { MatchProgress } from './match/MatchProgress';
import { MatchResult } from './match/matchResult';
import { PatternMatch } from './match/PatternMatch';
import { PatternTreeNode } from './patternTreeNode/PatternTreeNode';

export class PatternTreeContainer implements PatternMatcher {
	/** a list of expression trees, this is to save time (to not recursively have to get patterns from parents or something). we will start at the top and end at this container.
	*/
	containersToTraverse: PatternTreeContainer[] = [];
	trees = new Array<PatternTree>(PatternType.count);
	functions = new Map<string, SkriptFunction>();
	constructor(parent?: PatternTreeContainer) {
		for (let i = 0; i < PatternType.count; i++) {
			this.trees[i] = new PatternTree();
		}
		if (parent)
			this.containersToTraverse.push(...parent.containersToTraverse);
		this.containersToTraverse.push(this);
	}

	testTypeNodes(testChild: (testChild: PatternTreeNode) => boolean, node: PatternTreeNode, possibleTypes: SkriptTypeState) {
		//make sure there are any types to check. this also makes sure that we can check for object, the base class of any type.
		if (!possibleTypes.possibleTypes.length) return;
		const testClass = (testKey: string): boolean => {
			const typeChild = node.typeOrderedChildren.get(testKey);
			return typeChild != undefined && testChild(typeChild);
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
			for (const [key, val] of node.typeOrderedChildren) {
				if (!testedTypes.has(key)) {
					if (testChild(val)) {
						return;
					}
				}
			}
		}
		else if (!testedTypes.has("object[s]"))
			testClass("object[s]");

	}

	canSubstitute(progress: MatchProgress) {
		return !canBeSubPattern(progress.patternType) || (progress.currentNode !== progress.startNode);
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
	getMatchingPatternPart(testPattern: SkriptPatternCall, progress: MatchProgress, index: number = 0, argumentIndex: number = 0, recursion: number = 0): MatchResult | undefined {

		//RULES
		//when a pattern is found, the function that found the end of the pattern adds the patternmatch
		//when calling recursively, never move the index back
		const pattern = testPattern.pattern;
		for (; index <= pattern.length; index++) {
			function isSeparator(checkIndex: number = index): boolean {
				return / |'/.test(pattern[checkIndex]);
			}
			//multiple recursive matches may end at the same time
			//for example:
			//set {_var} to 3 + 4
			//% + % and set % to % both end at the same time
			const endNodeData = progress.currentNode.endNode;
			if (endNodeData) {
				//we have a potential match!
				if (index == pattern.length && !progress.parent) {
					progress.foundPattern = endNodeData;
					//this is the end of the pattern. now the full pattern has matched!
					const result = new MatchResult(testPattern, new PatternMatch(endNodeData, progress.start, index));
					return result;
				}
				else if (index == pattern.length || isSeparator() && canBeSubPattern(progress.patternType)) {
					//this part, a substitute, was parsed correctly. but now, we should continue the parent node.
					//we will iterate over all parent type nodes which accept an instance of the return value.
					//basically, we replaced the subpattern for a '%'
					//even when index == pattern.length, we should check base classes, because we didn't determine yet which type node it is
					let fullMatch: MatchResult | undefined;

					const testNode = (parentProgress: MatchProgress): boolean => {
						const testTypeChild = (testChild: PatternTreeNode): boolean => {
							//clone
							const testProgress: MatchProgress = { ...parentProgress, currentNode: testChild, startNode: testChild };
							fullMatch = this.getMatchingPatternPart(testPattern, testProgress, index, argumentIndex, recursion + 1);
							return fullMatch != undefined;
						}
						this.testTypeNodes(testTypeChild, parentProgress.currentNode, endNodeData.returnType);

						if (fullMatch) {
							//add the submatch to its parent match
							const childMatch = new PatternMatch(endNodeData, progress.start, index);
							const parentMatch = fullMatch.fullMatch.getDeepestChildNodeAt(progress.start);
							//we know for sure that each match we will add, is further to the start. so we can add matches to the start of the deepest child node.
							parentMatch.children.unshift(childMatch);
							return true;
						}
						return false;
					}

					if (progress.parent) {
						//maybe this is a submatch of a higher level match.
						if (testNode(progress.parent)) return fullMatch;
					}
					if (this.canSubstitute(progress)) {
						//maybe this is the first submatch of a higher level match.
						for (const container of this.containersToTraverse) {
							const root = container.trees[PatternType.expression].compileAndGetRoot();
							//create a new parent node, which replaces the current node. the current node becomes a child.
							if (testNode({
								start: progress.start,
								parent: progress.parent,
								startNode: root,
								currentNode: root,
								patternType: PatternType.expression
							})) return fullMatch;
						}
					}

					//when no full match is found, we just continue
				}
			}
			if (index == pattern.length)
				//no match stopped at this position
				//the pattern call is shorter than the patterns
				return undefined;

			//maybe this part of the pattern belongs to a submatch?
			const hasValidTypeNodes =
				(progress.currentNode.typeOrderedChildren.size > 0) &&
				(index == 0 || isSeparator(index - 1))



			const currentChar = pattern[index];
			const charChild = progress.currentNode.stringOrderedChildren.get(currentChar);
			if (charChild) {
				if (hasValidTypeNodes) {
					//check the normal path (just traversing the tree based on charachters we encounter) first. the only way to do that without queueing the alternatives is calling a function.

					//clone
					const testProgress: MatchProgress = { ...progress, currentNode: charChild };
					const testResult = this.getMatchingPatternPart(testPattern, testProgress, index + 1, argumentIndex, recursion + 1);
					if (testResult)
						return testResult;
					//just matching by charachters didn't work.
				}
				else {
					//we'll just continue matching by charachters
					progress.currentNode = charChild;
					continue;
				}
			}
			if (progress.currentNode.typeOrderedChildren.size) {
				let testResult: MatchResult | undefined;
				let newIndex = index;
				let newArgumentIndex = argumentIndex;
				const testClass = (typeChild: PatternTreeNode): boolean => {
					const testProgress: MatchProgress = { ...progress, currentNode: typeChild, startNode: progress.currentNode };
					//testProgress.currentNode = typeChild;
					//estProgress.startNode = testProgress.currentNode;
					if (typeChild &&
						(testResult = this.getMatchingPatternPart(testPattern, testProgress, newIndex, newArgumentIndex)))
						return true;
					return false;
				}

				if (currentChar == '%' &&
					argumentIndex < testPattern.expressionArguments.length) {
					//test all base classes recursively
					const currentArgument = testPattern.expressionArguments[argumentIndex];
					newIndex++;
					newArgumentIndex++;
					this.testTypeNodes(testClass, progress.currentNode, currentArgument);
					if (testResult)
						return testResult;
				}
				else if (/[0-9-]/.test(currentChar)) {

					//this is a number
					const numberPattern = this.containersToTraverse[0].trees[PatternType.expression].incompatiblePatterns[0];
					let numberMatch = new RegExp(numberPattern.regexPatternString);
					let matchArray: RegExpExecArray | null;
					if (matchArray = numberMatch.exec(pattern.substring(index))) {
						newIndex += matchArray[0].length;
					}
					const currentArgument: SkriptTypeState = numberPattern.returnType;
					this.testTypeNodes(testClass, progress.currentNode, currentArgument);
					if (testResult) {
						//add the submatch to its parent match
						const childMatch = new PatternMatch(numberPattern, index, newIndex);
						const parentMatch = testResult.fullMatch.getDeepestChildNodeAt(progress.start);
						//we know for sure that each match we will add, is further to the start. so we can add matches to the start of the deepest child node.
						parentMatch.children.unshift(childMatch);
						return testResult;
					}


					//const numberNode = progress.currentNode.typeOrderedChildren.get('num[ber][s]');
					//if (numberNode && testClass(numberNode)) return testResult;
					//const objectNode = progress.currentNode.typeOrderedChildren.get('object[s]');
					//if (objectNode && testClass(objectNode)) return testResult;
					//if (testResult)
					//	return testResult;
				}
			}
			//all possibilities have been tested, but there haven't been any children who fit this pattern. we need to submatch.
			//we will try finding a pattern from the expression trees which returns an instance of the expected type.
			if (hasValidTypeNodes) {
				//infinite recursion happens when the currentnode is root
				if (this.canSubstitute(progress)) {
					let testResult: MatchResult | undefined;
					for (const container of this.containersToTraverse) {
						//clone
						const nextProgress: MatchProgress = { ...progress };

						const root = container.trees[PatternType.expression].compileAndGetRoot();

						testResult = this.getMatchingPatternPart(testPattern, { start: index, parent: nextProgress, currentNode: root, startNode: root, patternType: PatternType.expression }, index, argumentIndex, recursion + 1);
						if (testResult) return testResult;
					}
				}
			}

			//this node was not found
			return undefined;
		}
		//we got to the end of the string without matching a pattern
		return undefined;
	}

	//the tree should be compiled before this method is called
	getPatternData(testPattern: SkriptPatternCall): MatchResult | undefined {
		//loop all trees we can traverse
		for (const container of this.containersToTraverse) {
			const tree = container.trees[testPattern.patternType];
			const root = tree.compileAndGetRoot();
			const data = this.getMatchingPatternPart(testPattern, { start: 0, currentNode: root, startNode: root, patternType: testPattern.patternType });
			if (data) return data;
			//return data?.foundPattern;
			//if (data.matches.length)
			//	//we don't need to compare argument types, they are compared already
			//	//if (testPattern.compareArgumentTypes(data)) {
			//	return data;
			////}
			//
			////check against incompatible patterns. heavy!
			//for (const pattern of this.incompatiblePatterns) {
			//	let array = testPattern.compare(pattern);
			//	if (array.matches.length) {
			//		data.matches.push(...array.matches);
			//		if (array.matches[array.matches.length - 1].endIndex == testPattern.pattern.length)
			//			//if not, we'll have to keep matching until the patterns full length is matched
			//			return data;
			//	}
			//}
			//return data;
		}
		return undefined;
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

	//add patterns of other container to this container
	merge(other: PatternTreeContainer): void {
		for (let i = 0; i < PatternType.count; i++) {
			this.trees[i].merge(other.trees[i]);
		}
		this.functions = new Map([...this.functions.entries(), ...other.functions.entries()]);
	}
}