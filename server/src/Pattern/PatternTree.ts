import { DiagnosticSeverity } from 'vscode-languageserver';
import { Location } from 'vscode-languageserver/node';
import { SkriptNestHierarchy } from '../nesting/SkriptNestHierarchy';
import type { SkriptPatternContainerSection } from '../skript/section/reflect/SkriptPatternContainerSection';
import { SkriptTypeState } from "../skript/storage/type/SkriptTypeState";
import { SkriptContext } from '../skript/validation/SkriptContext';
import { TokenTypes } from '../TokenTypes';
import { PatternData } from './data/PatternData';
import { PatternTreeNode } from './patternTreeNode/PatternTreeNode';
import { PatternType } from './PatternType';
import { RegExpTreeError } from './RegExpTreeError';
import { removeDuplicates } from "./removeDuplicates";

import { SkriptTypeSection } from '../skript/section/custom/SkriptTypeSection';
import { TokenModifiers } from '../TokenModifiers';
import { TypeNode } from './patternTreeNode/TypeNode';

//flags: U -> ungreedy, g -> global
const argumentRegExp = /(?<=\\)%(.*?)(?<=\\)%/g;

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
	fixedString = fixedString.replace(/ ?\.\+ ?/g, (match) => {
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

export class PatternTree {
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
							if (index ? pattern[index - 1] != '\\' : true)
								argumentIndex++;
						}
						if (argumentIndex < data.expressionArguments.length) {
							//let node = new TypeNode(data.expressionArguments[argumentIndex]);
							const typeState = data.expressionArguments[argumentIndex];
							for (const possibleType of typeState.possibleTypes) {
								//for debugger
								if (possibleType.section) {
									let node = currentSplitNode.typeOrderedChildren.get(possibleType.skriptPatternString);
									if (!node) {
										currentSplitNode.typeOrderedChildren.set(possibleType.skriptPatternString, node = new TypeNode(possibleType.section as SkriptTypeSection));
									}
									newNodes.push(node);
								}
							}
						}
					}
					else {
						if (char == '\\') char = pattern[i + 1];
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
				if (char == '\\') i++;

			}
			if (newNodes) {
				currentNodes = removeDuplicates(newNodes);
			}
		}
		return currentNodes;
	}

	//add a pattern to the tree
	private addToTree(data: PatternData): void {
		//for debugger
		if (this.root) {
			const regExpHierarchy = createRegExpHierarchy(data.regexPatternString);
			const endNodes = this.addPatternPart(data, [this.root], regExpHierarchy);
			for (const node of endNodes) {
				node.endNode = data;
			}
		}
	}
	compileAndGetRoot(): PatternTreeNode {
		if (!this.root) {
			this.root = new PatternTreeNode();
			for (const p of this.compatiblePatterns) {
				this.addToTree(p);
			}
		}
		return this.root;
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

		let lastActiveNode = hierarchy.getActiveNode();
		if (lastActiveNode.character == '|') {
			lastActiveNode.end = hierarchy.end;//pop
			lastActiveNode = hierarchy.getActiveNode();
		}
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
		if (!context.hasErrors) {
			let m: RegExpMatchArray | null;
			const expressionArguments: SkriptTypeState[] = [];
			let shouldReturn = false;
			const argumentPositions: Location[] = [];
			let previousTokenEndPos = 0;
			while ((m = argumentRegExp.exec(context.currentString))) {
				//for debugger
				if (m.index != undefined) {
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
			}
			context.addToken(TokenTypes.regexp, previousTokenEndPos, undefined, [TokenModifiers.definition]);
			if (shouldReturn) return;

			let fixedString = convertSkriptPatternToRegExp(context.currentString, Hierarchy);

			try {
				fixedString = fixedString.trim();

				let regExpHierarchy: SkriptNestHierarchy;


				fixedString = fixedString.replace(argumentRegExp, '%').toLowerCase();

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
		if (/\\d\+|(?<!\\)(\+|\*|\.)/.exec(pattern.regexPatternString)) {
			//these patterns are not compatible with the tree
			//these patterns are roughly always patterns which we don't need anyways, because they don't provide intelligent support.
			//for example: expr-1 shouldn't be available in each context
			//the loop-value shouldn't be available in each context either
			//etc.
			if (pattern.definitionLocation.uri.includes('IntelliSkript.sk')) {
				//defined by intelliskript, this pattern should be safe to use
				this.incompatiblePatterns.push(pattern);
			}
		}
		//if (pattern.skriptPatternString[0] == '<' && pattern.skriptPatternString[pattern.skriptPatternString.length - 1] == '>') {
		//	//most of these patterns aren't actually used in our code
		//	//if(pattern.regexPatternString.includes('\\d+'))
		//	this.incompatiblePatterns.push(pattern);
		//}
		else {
			this.compatiblePatterns.push(pattern);
			if (this.root) {
				this.addToTree(pattern);
			}
		}
	}
}