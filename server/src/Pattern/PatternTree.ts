import { DiagnosticSeverity, integer } from 'vscode-languageserver';
import { Location } from 'vscode-languageserver/node';
import { SkriptNestHierarchy } from '../nesting/SkriptNestHierarchy';
import type { SkriptPatternContainerSection } from '../skript/section/reflect/SkriptPatternContainerSection';
import { SkriptContext } from '../skript/SkriptContext';
import { SkriptTypeState } from "../skript/SkriptTypeState";
import { PatternData } from './data/PatternData';
import { PatternTreeNode } from './patternTreeNode/PatternTreeNode';
import { RegExpTreeError } from './RegExpTreeError';
import { PatternResultProcessor } from './patternResultProcessor';
import { PatternMatcher } from './PatternMatcher';
import { SkriptPatternCall } from './SkriptPattern';
import { TokenTypes } from '../TokenTypes';
import { PatternType } from './PatternType';
import { removeDuplicates } from "./removeDuplicates";
import assert = require('assert');
import { TypeNode } from './patternTreeNode/TypeNode';
import { TokenModifiers } from '../TokenModifiers';

//flags: U -> ungreedy, g -> global
const argumentRegExp = /%(.*?)%/g;

function convertSkriptPatternToRegExp(pattern: string, hierarchy: SkriptNestHierarchy): string {
	function convertString(input: string): string {
		const replaceRegex = /\?|\+|\*|\/|\./g;
		return input.replace(replaceRegex, "\\$&").replace(/\(|\)/g, '(\\$&)?');
	}
	let currentPosition = hierarchy.start;
	let fixedString = '';
	for (const child of hierarchy.children) {
		if (child.start - 1 > currentPosition) {
			fixedString += convertString(pattern.substring(currentPosition, child.start - 1));
		}
		if (child.character == '[') {
			fixedString += '(';
		}
		else if (child.character == '(') {
			fixedString += child.character;
		}
		else if (child.character == '|') {
			if (child.start > hierarchy.start) {
				fixedString += child.character;
			}
		}
		if (child.character == '<') {
			fixedString += pattern.substring(child.start, child.end);
		}
		else {
			fixedString += convertSkriptPatternToRegExp(pattern, child);
		}
		if (child.character == '[') {
			fixedString += ')?';
		}
		else if (child.character == '(') {
			fixedString += ')';
		}
		currentPosition = child.end + 1;
	}
	if (currentPosition < hierarchy.end) {
		fixedString += convertString(pattern.substring(currentPosition, hierarchy.end));
	}
	fixedString = fixedString.replace(/ ?\.\+ ?/g, (match, offset, wholeString) => {
		return `(${match})?`;
	});

	return fixedString;
	//let fixedString = pattern.substring(hierarchy.start, hierarchy.children[
}

function createRegExpHierarchy(regExString: string): SkriptNestHierarchy {

	const openBraces = "([<";//< starts a regular expression, we don't have to create a hierarchy in there
	const closingBraces = ")]>";
	const hierarchy = new SkriptNestHierarchy(0, '');

	for (let i = 0; i < regExString.length; i++) {
		const char = regExString[i];
		if ((openBraces + closingBraces + '|\\').includes(char)) {
			let node = hierarchy.getActiveNode();
			if (closingBraces.includes(char)) {
				if (node.character != '[' || char == ']') {
					node.end = i; //pop
					const linkedOpenbrace = openBraces[closingBraces.indexOf(char)];
					if (node.character != linkedOpenbrace) {
						node = hierarchy.getActiveNode();
						if (node != hierarchy) {
							node.end = i; //pop twice (needed for pipes and if a brace was placed incorrectly)
						}
					}
				}
			}
			else if (node.character != '[') {
				if (openBraces.includes(char)) {
					node.children.push(new SkriptNestHierarchy(i + 1, char));
				}
				else if (char == '|') {
					if (node.character == '|') {
						node.end = i;//pop
						node = hierarchy.getActiveNode();
					}
					else {
						const n1 = new SkriptNestHierarchy(node.start, '|');

						//move children to node 1
						n1.children = node.children;
						node.children = [];
						n1.end = i;
						node.children.push(n1);
					}
					const n2 = new SkriptNestHierarchy(i + 1, '|');
					node.children.push(n2);
				}
				else if (char == '\\') {
					++i;
				}
			}
		}
	}

	let lastActiveNode = hierarchy.getActiveNode();
	if (lastActiveNode.character == '|') {
		//pop
		lastActiveNode.end = regExString.length;
		lastActiveNode = hierarchy.getActiveNode();
	}
	if (lastActiveNode != hierarchy) {
		throw new RegExpTreeError("no matching closing character found", lastActiveNode.start);
	}
	hierarchy.end = regExString.length;
	return hierarchy;
}

export class PatternTree implements PatternMatcher {
	root: PatternTreeNode | undefined;
	incompatiblePatterns: PatternData[] = [];
	compatiblePatterns: PatternData[] = [];

	merge(other: PatternTree): void {
		this.incompatiblePatterns.push(...other.incompatiblePatterns);
		this.compatiblePatterns.push(...other.compatiblePatterns);
	}

	//returns endnodes of the pattern parts
	//for example, this pattern has two endnodes:
	//send [the | % to the] player
	addPatternPart(data: PatternData, currentNodes: PatternTreeNode[], Hierarchy: SkriptNestHierarchy): PatternTreeNode[] {
		const pattern = data.regexPatternString;//.replace(/\\(.)/g, "$1");
		if (Hierarchy.children.length && Hierarchy.children[0].character == '|') {
			//divide in [ | ]
			let allOptionEnds: PatternTreeNode[] = [];
			for (const child of Hierarchy.children) {
				const optionEnds = this.addPatternPart(data, currentNodes, child);
				allOptionEnds = allOptionEnds.concat(optionEnds);
			}
			return allOptionEnds;
		}
		//loop over all charachters in this member of the hierarchy
		//for example, when we are processing the [] of "send [the | % to the] player", we would loop over "the | % to the".
		for (let i = Hierarchy.start; i < Hierarchy.end; i++) {
			let newNodes: PatternTreeNode[] | undefined;
			let char = pattern[i];
			if (char == '(') {
				//required segment, needed for pipes. for example, a(b|c) != ab|c
				const node = Hierarchy.getChildNodeStartAt(i + 1);
				if (node != undefined) {
					const optionEnds = this.addPatternPart(data, currentNodes, node);
					if (pattern[node.end + 1] == '?') {
						//optional segment
						newNodes = currentNodes.concat(optionEnds);
						i = node.end + 1; //+1 but the +1 gets added in the loop already
					}
					else {
						newNodes = optionEnds;
						i = node.end; //+1 but the +1 gets added in the loop already
					}
				}
			}
			else {
				//this way, we can escape braces
				//for example: (\(test\))
				//todo: escape types
				if(char == '\\')
					char = pattern[++i];
				newNodes = [];
				let treeElem = undefined;
				//for each possibility of this pattern, loop over the letters
				for (let splitNodeIndex = 0; splitNodeIndex < currentNodes.length; splitNodeIndex++) {
					const currentSplitNode = currentNodes[splitNodeIndex];
					if ((char == ' ') && ((currentSplitNode.patternKey == ' '))) {
						//no double spaces
						newNodes.push(currentSplitNode);
					}
					else if (char == '%') {
						//check which type this is

						let index = -1;
						let argumentIndex = 0;
						//find the argument index. this is also safe for if we want to access elements earlier
						//like when we first process the second %, then the first one
						while ((index = pattern.indexOf('%', index + 1)) != i) {
							argumentIndex++;
						}
						let node = new TypeNode(data.expressionArguments[argumentIndex]);
						let typeNodeIndex = 0;
						const otherNodes = currentSplitNode.otherNodes;
						for (; typeNodeIndex < otherNodes.length; typeNodeIndex++) {
							//what are we comparing here?
							if (otherNodes[typeNodeIndex] instanceof TypeNode) {
								if (node.compare(otherNodes[typeNodeIndex] as TypeNode))
									break;
							}
						}
						if (typeNodeIndex == otherNodes.length) {
							otherNodes.push(node);
						}
						else {
							node = otherNodes[typeNodeIndex] as TypeNode;
						}
						newNodes.push(node);
					}
					else {
						const currentTreeElem = currentSplitNode.stringOrderedChildren.get(char);
						if (currentTreeElem == undefined) {
							if (treeElem == undefined) {
								treeElem = new PatternTreeNode(char);
								newNodes.push(treeElem);
							}
							currentSplitNode.stringOrderedChildren.set(char, treeElem);
						}
						else {
							newNodes.push(currentTreeElem);
						}
					}
				}
			}
			if (newNodes) {
				currentNodes = removeDuplicates(newNodes);
			}
		}
		return currentNodes;
	}

	//add a pattern to the tree
	private addToTree(data: PatternData): void {
		const regExpHierarchy = createRegExpHierarchy(data.regexPatternString);
		assert(this.root != undefined);
		const endNodes = this.addPatternPart(data, [this.root], regExpHierarchy);
		for (const node of endNodes) {
			node.endNode = data;
		}
	}
	compile(): void {
		this.root = new PatternTreeNode();
		for (const p of this.compatiblePatterns) {
			this.addToTree(p);
		}
	}

	static createHierarchy(context: SkriptContext): SkriptNestHierarchy {
		const openBraces = "([<";//< starts a regular expression, we don't have to create a hierarchy in there
		const closingBraces = ")]>";
		const hierarchy = new SkriptNestHierarchy(0, '');

		for (let i = 0; i < context.currentString.length; i++) {
			const char = context.currentString[i];
			if ((openBraces + closingBraces + '|\\').includes(char)) {
				let node = hierarchy.getActiveNode();
				if (closingBraces.includes(char)) {
					if (node.character != '<' || char == '>') {

						const linkedOpenbrace = openBraces[closingBraces.indexOf(char)];
						if ((char == ')') && (node.character == '[')) {
							//just ignore, this is a literal brace
							continue;
						}

						node.end = i; //pop
						if (node.character != linkedOpenbrace) {
							const oldNode = node;
							node = hierarchy.getActiveNode();
							if (oldNode.character == '(') {//this was a literal brace
								node.children = node.children.splice(0, node.children.length - 1);
								node.children.push(...oldNode.children);
							}
							if (node != hierarchy) {
								node.end = i; //pop twice (needed for pipes and if a brace was placed incorrectly)
							}
						}
					}
				}
				else if (node.character != '<') {
					if (openBraces.includes(char)) {
						node.children.push(new SkriptNestHierarchy(i + 1, char));
					}
					else if (char == '|') {
						if (node.character == '|') {
							node.end = i;//pop
							node = hierarchy.getActiveNode();
						}
						else {
							const n1 = new SkriptNestHierarchy(node.start, '|');

							//move children to node 1
							n1.children = node.children;
							node.children = [];
							n1.end = i;
							node.children.push(n1);
						}
						const n2 = new SkriptNestHierarchy(i + 1, '|');
						node.children.push(n2);
					}
					else if (char == '\\') {
						++i;
					}
				}
			}
		}
		hierarchy.end = context.currentString.length;

		const lastActiveNode = hierarchy.getActiveNode();
		if (lastActiveNode != hierarchy) {
			context.addDiagnostic(lastActiveNode.start, hierarchy.end - lastActiveNode.start, "no matching closing character found", DiagnosticSeverity.Error, "IntelliSkript->Nest->No Matching");
		}
		return hierarchy;
	}

	static fixRegExpHierarchically(currentString: string, hierarchy: SkriptNestHierarchy): string {
		//wether the current expression NEEDS a space to the right or it can 'lend' it to a child
		let canLendSpaceRight = true;
		let lastLendCheck = hierarchy.start - 1;
		let lastFixIndex = hierarchy.start;
		let fixedString = '';
		for (let i = 0; i < hierarchy.children.length; i++) {
			const node = hierarchy.children[i];
			let fixedNode = false;
			if (node.character == '(') {
				if (currentString[node.end + ')'.length] == '?') {
					const spaceCheckPosition = node.start - 2;
					const hasSpaceLeft = currentString[spaceCheckPosition] == ' ';
					const childResult = this.fixRegExpHierarchically(currentString, node);

					if (hasSpaceLeft) {
						fixedString += currentString.substring(lastFixIndex, node.start - ' ('.length) + '( ';
						fixedNode = true;
						fixedString += childResult;
						lastFixIndex = node.end;
						lastLendCheck = node.end + ')'.length;
						canLendSpaceRight = true;
					}
					else {
						const hasSpaceRight = currentString[node.end + ')?'.length] == ' '; //not correct, it could be that there is another child to the right of here
						if (hasSpaceRight) {
							if (lastLendCheck != spaceCheckPosition) canLendSpaceRight = hasSpaceLeft;//update
							//needsSpaceRight = lastSpaceCheck != spaceCheckPosition ? !hasSpaceLeft : needsSpaceRight;
							if (canLendSpaceRight) {
								fixedNode = true;
								fixedString += currentString.substring(lastFixIndex, node.start);
								fixedString += childResult + ' )?';
								lastFixIndex = node.end + ')? '.length;
								//canLendSpaceRight will already be true
								lastLendCheck = node.end + ' )'.length;
							}
						}
					}
				}
			}
			if (!fixedNode) {
				fixedString += currentString.substring(lastFixIndex, node.start);
				const childResult = this.fixRegExpHierarchically(currentString, node);
				fixedString += childResult;
				lastFixIndex = node.end;
			}
		}
		fixedString += currentString.substring(lastFixIndex, hierarchy.end);
		return fixedString;
	}

	static parsePattern(context: SkriptContext, patternSection: SkriptPatternContainerSection, type: PatternType): PatternData | undefined {
		const Hierarchy = this.createHierarchy(context);
		assert(context.currentSection);
		if (!context.hasErrors) {
			let m: RegExpMatchArray | null;
			const expressionArguments: SkriptTypeState[] = [];
			let shouldReturn = false;
			const argumentPositions: Location[] = [];
			let previousTokenEndPos = 0;
			while ((m = argumentRegExp.exec(context.currentString))) {
				assert(m.index != undefined);
				const typeStart = m.index + 1;
				const typeString = m[1];
				context.addToken(TokenTypes.regexp, previousTokenEndPos, typeStart - previousTokenEndPos, [TokenModifiers.definition]);
				const result = context.currentSection.parseTypes(context, typeStart, typeStart + typeString.length);
				if (result) {
					expressionArguments.push(result);
				}
				else {
					context.addDiagnostic(typeStart, typeString.length, "this type is not recognized", DiagnosticSeverity.Error, "IntelliSkript->Type->Not Recognized");
					const obj = context.currentSection.getTypeData('object');
					if (obj) {//we expect the 'object' type to always be available
						expressionArguments.push(new SkriptTypeState(obj));
					}
					else {
						shouldReturn = true;
					}
				}
				previousTokenEndPos = typeStart + typeString.length;
				argumentPositions.push(context.getLocation(typeStart, typeString.length));
			}
			context.addToken(TokenTypes.regexp, previousTokenEndPos, undefined, [TokenModifiers.definition]);
			if (shouldReturn) return;

			let fixedString = convertSkriptPatternToRegExp(context.currentString, Hierarchy);

			try {
				fixedString = fixedString.trim();

				let regExpHierarchy: SkriptNestHierarchy;


				fixedString = fixedString.replace(argumentRegExp, '%');

				regExpHierarchy = createRegExpHierarchy(fixedString);
				fixedString = this.fixRegExpHierarchically(fixedString, regExpHierarchy);
				regExpHierarchy = createRegExpHierarchy(fixedString);

				const data = new PatternData(context.currentString, fixedString, context.getLocation(0, context.currentString.length), type, patternSection, expressionArguments, argumentPositions);
				return data;
			}
			catch (e) {
				let message;
				if (e instanceof Error) {
					message = e.message;
				}
				else if (e instanceof SyntaxError) {
					message = "regex syntax error: " + e.message;
				}
				else {
					message = "unknown regexp hierarchical error";
				}
				context.addDiagnostic(0, context.currentString.length, message);
			}
		}
		return undefined;
	}

	addPattern(pattern: PatternData) {
		if (/\d\+|(?<!\\)(\+|\*|\.)/.exec(pattern.regexPatternString)) {
			//regex is not compatible with the tree
			this.incompatiblePatterns.push(pattern);
		} else {
			this.compatiblePatterns.push(pattern);
			if (this.root) {
				this.addToTree(pattern);
			}
		}
	}

	getMatchingPatternPart(testPattern: SkriptPatternCall, currentNode: PatternTreeNode, index: number = 0, typeIndex: number = 0): PatternData | undefined {
		const pattern = testPattern.pattern;
		if (!currentNode) return undefined;
		for (; index <= pattern.length; index++) {
			if (currentNode.endNode) { // && (index == (pattern.length))) {
				// we don't have to stop the match earlier anymore, because we match against all possibilities
				if (index == pattern.length) {//} || (pattern[index] == ' ')) {
					return currentNode.endNode;
				}
			}
			else if (index == pattern.length) return undefined;
			const currentChar = pattern[index];
			const charChild = currentNode.stringOrderedChildren.get(currentChar);
			if (charChild) {
				currentNode = charChild;
				continue;
			}
			else {
				for (const otherChild of currentNode.otherNodes) {
					if (otherChild instanceof TypeNode && typeIndex < testPattern.expressionArguments.length) {
						if (testPattern.expressionArguments[typeIndex].canBeInstanceOf((otherChild as TypeNode).type)) {
							// we could also do a lookup for multiple types
							// for example: match "a %number% b" against "a %object% b" and "a %number%". in this case the first occurrence would be better
							const resultOption = this.getMatchingPatternPart(testPattern, otherChild, index + 1, typeIndex + 1);
							if (resultOption) {
								return resultOption;
							}
						}
					}
				}
			}
			return undefined;
		}
		//if (currentNode.endNode) {
		//	return currentNode.endNode;
		//}
	}

	//the tree should be compiled before this method is called
	getPatternData(testPattern: SkriptPatternCall, shouldContinue: PatternResultProcessor): PatternData | undefined {
		if (!this.root) {
			if (this.compatiblePatterns.length) {
				this.compile();
				assert(this.root != undefined);
			}
			else {
				return undefined;
			}
		}
		const data = this.getMatchingPatternPart(testPattern, this.root);
		if (data) {
			//we don't need to compare argument types, they are compared already
			//if (testPattern.compareArgumentTypes(data)) {
			if (!shouldContinue(data)) {
				return data;
			}
			//}
		}
		//for now, let's not do anything with incompatible patterns
		//for (const pattern of this.incompatiblePatterns) {
		//	if (testPattern.compare(pattern) && (!shouldContinue(pattern))) {
		//		return pattern;
		//	}
		//}
	}
}