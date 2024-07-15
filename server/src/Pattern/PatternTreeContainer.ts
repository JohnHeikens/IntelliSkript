import { PatternData } from "../pattern/data/PatternData";
import { PatternTree } from '../pattern/PatternTree';
import { PatternResultProcessor } from "../pattern/patternResultProcessor";
import { PatternType } from '../pattern/PatternType';
import type { SkriptPatternContainerSection } from '../skript/section/reflect/SkriptPatternContainerSection';
import { SkriptContext } from '../skript/validation/SkriptContext';
import { PatternMatcher } from '../pattern/PatternMatcher';
import { SkriptPatternCall } from '../pattern/SkriptPattern';
import { MatchArray } from './match/matchArray';
import { MatchProgress } from './match/MatchProgress';
import { SkriptTypeSection } from '../skript/section/custom/SkriptTypeSection';
import assert = require('assert');
import { TypeNode } from './patternTreeNode/TypeNode';

export class PatternTreeContainer implements PatternMatcher {
	trees = new Array<PatternTree>(PatternType.count);
	/**
	 * ordered by type, to optimize the amount of patterns to check.
	 * for example, when we have a pattern like send %string% to %offline player%, we only have to check for 'string' and 'object'. (and things which can convert to string)
	 * patterns which return something else, don't have to be checked!
	 */
	expressionTrees = new Map<string, PatternTree>();
	constructor() {
		for (let i = 0; i < PatternType.count; i++) {
			this.trees[i] = new PatternTree();
		}
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
	getMatchingPatternPart(testPattern: SkriptPatternCall, progress: MatchProgress, index: number = 0, argumentIndex: number = 0, recursion: number = 0): PatternData | undefined {
		//assert(this.root);
		const pattern = testPattern.pattern;
		for (; index <= pattern.length; index++) {
			const isSeparator = (checkIndex: number = index): boolean => / |'/.test(pattern[checkIndex])
			//multiple recursive matches may end at the same time
			//for example:
			//set {_var} to 3 + 4
			//% + % and set % to % both end at the same time
			if (progress.currentNode.endNode) {
				const result = progress.currentNode.endNode;
				//we have a potential match!
				if (progress.parent) {
					//this part, a substitute, was parsed correctly. but now, we should continue the parent node.
					//we will iterate over all parent type nodes which accept an instance of the return value.
					//basically, we replaced the subpattern for a '%'
					let fullMatch: PatternData | undefined;
					const testClass = (testType: SkriptTypeSection): boolean => {
						assert(progress.parent);
						const typeChild = progress.parent.currentNode.getTypeChild(testType);
						if (typeChild) {
							const typeProgress = new MatchProgress(progress.parent.root, progress.parent.parent, typeChild);
							fullMatch = this.getMatchingPatternPart(testPattern, typeProgress, index, argumentIndex + 1);
							if (fullMatch) return true;
						}
						return false;
					}
					//even when index == pattern.length, we should check base classes, because we didn't determine yet which type node it is
					if (index == pattern.length || isSeparator()) {
						result.returnType.iterateBaseClasses(testClass);
						if (fullMatch) return fullMatch;
					}
					//when no full match is found, we just continue
				}
				else {
					if (index == pattern.length) {
						//this is the end of the pattern. now the full pattern has matched!
						return result;
					}
					else {
						//this endnode doesn't 'fit' our pattern, it ends too early. continue matching
					}
				}

			}
			if (index == pattern.length)
				//no match stopped at this position
				//the pattern call is shorter than the patterns
				return undefined;

			//maybe this part of the pattern belongs to a submatch?
			const hasAlternatives = (progress.currentNode.typeOrderedChildren.size > 0) &&
				(index == 0 || isSeparator(index - 1));

			const currentChar = pattern[index];
			const charChild = progress.currentNode.stringOrderedChildren.get(currentChar);
			if (charChild) {
				if (hasAlternatives) {
					//check the normal path (just traversing the tree based on charachters we encounter) first. the only way to do that without queueing the alternatives is calling a function.

					const testProgress = new MatchProgress(progress.root, progress.parent, charChild);
					const testResult = this.getMatchingPatternPart(testPattern, testProgress, index + 1, argumentIndex, recursion + 1);
					if (testResult)
						return testResult;
				}
				else {
					progress.currentNode = charChild;
					continue;
				}
			}
			else if (currentChar == '%' &&
				argumentIndex < testPattern.expressionArguments.length &&
				progress.currentNode.typeOrderedChildren.size) {
				//test all base classes recursively
				let testResult: PatternData | undefined;
				const testedTypes = new Set<string>();

				const testClass = (testType: SkriptTypeSection): boolean => {
					const typeChild = progress.currentNode.getTypeChild(testType);
					if (typeChild) {//some patterns accept this type
						const testProgress = new MatchProgress(typeChild, progress.parent);
						if (typeChild &&
							(testResult = this.getMatchingPatternPart(testPattern, testProgress, index + 1, argumentIndex + 1)))
							return true;
					}
					return false;
				}

				const currentArgument = testPattern.expressionArguments[argumentIndex];
				const testAllTypes = currentArgument.iterateBaseClasses(testClass, testedTypes);

				//when there is a possibility that the type is unknown, test all the possible types
				if (testAllTypes) {
					for (const [key, val] of progress.currentNode.typeOrderedChildren) {
						if (!testedTypes.has(key)) {
							testResult = this.getMatchingPatternPart(testPattern, new MatchProgress(val, progress.parent), index + 1, argumentIndex + 1, recursion + 1);
							if (testResult)
								return testResult;
						}
					}
				}
			}
			if (hasAlternatives) {
				//all possibilities have been tested, but there haven't been any children who fit this pattern. we need to submatch.
				//we will try finding a pattern from the tree which returns an instance of the expected type.
				const testedTypes = new Set<string>();
				let testResult: PatternData | undefined;

				for (const [key, typeNode] of progress.currentNode.typeOrderedChildren) {
					//todo: reduce the amount of checking
					//for example, when there are two patterns:
					//a %boolean% b
					//a %object% c
					//and we matched for %object% in 'a %boolean% b', we should check for both b and c. we shouldn't have to check for %object% again when parsing 'a %object% c'
					const testClass = (testType: SkriptTypeSection): boolean => {
						//clone
						const nextProgress = new MatchProgress(progress.root, progress.parent, progress.currentNode);

						const typeTree = this.expressionTrees.get(testType.patterns[0]?.skriptPatternString);
						if (typeTree) {
							let checkProgress = progress;
							//loop over parents
							while (true) {
								//when currentNode == typeTree.root, this would cause infinite recursion.
								//for example % + % <- match begin
								//nothing found? match begin again
								if (checkProgress.currentNode === typeTree.root)
									return false;
								if (checkProgress.parent) {
									checkProgress = checkProgress.parent;
								}
								else break;
							}

							//nextProgress.currentNode = typeNode;
							testResult = this.getMatchingPatternPart(testPattern, new MatchProgress(typeTree.compileAndGetRoot(), nextProgress), index, argumentIndex, recursion + 1);
							if (testResult) return true;
						}
						return false;
					}
					(typeNode as TypeNode).type.testBaseClasses(testClass);
					return testResult;
				}
			}

			//this node was not found
			return undefined;
		}
		//we got to the end of the string without matching a pattern
		return undefined;
	}

	//the tree should be compiled before this method is called
	getPatternData(testPattern: SkriptPatternCall): PatternData | undefined {
		const tree = this.trees[testPattern.patternType];
		//if (!tree.root) {
		//	if (tree.compatiblePatterns.length) {
		//		tree.compile();
		//		assert(tree.root != undefined);
		//	}
		//	else
		//		return undefined;
		//
		//}
		let data = this.getMatchingPatternPart(testPattern, new MatchProgress(tree.compileAndGetRoot()));
		if (data) return data;
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

	addPattern(pattern: PatternData): void {
		if (pattern.patternType == PatternType.expression) {
			for (const type of pattern.returnType.possibleTypes) {
				//we may assume that each pattern only has one return value, so no optimization needed
				if (type.section) {
					let tree = this.expressionTrees.get(type.skriptPatternString);
					if (!tree) {
						tree = new PatternTree()
						this.expressionTrees.set(type.skriptPatternString, tree);
					}
					tree.addPattern(pattern);
				}
			}
		}
		else
			this.trees[pattern.patternType].addPattern(pattern);
	}

	merge(other: PatternTreeContainer): void {
		for (let i = 0; i < PatternType.count; i++) {
			this.trees[i].merge(other.trees[i]);
		}
	}
}