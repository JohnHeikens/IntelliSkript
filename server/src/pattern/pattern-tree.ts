import { DiagnosticSeverity } from 'vscode-languageserver';
import { Location } from 'vscode-languageserver/browser';
import { SkriptNestHierarchy } from '../nesting/skript-nest-hierarchy';
import type { ReflectPatternContainerSection } from '../skript/section/reflect/reflect-pattern-container-section';
import { SkriptTypeState } from "../skript/storage/type/skript-type-state";
import { SkriptContext } from '../skript/validation/skript-context';
import { TokenTypes } from '../token-types';
import { PatternData } from './data/pattern-data';
import { PatternTreeNode } from './pattern-tree-node/pattern-tree-node';
import { PatternType } from './pattern-type';
import { RegExpTreeError } from './regexp-tree-error';
import { removeDuplicates } from "./remove-duplicates";

import { SkriptTypeSection } from '../skript/section/custom/skript-type-section';
import { TokenModifiers } from '../token-modifiers';
import { RegExpNode } from './pattern-tree-node/regexp-node';
import { StringNode } from './pattern-tree-node/string-node';
import { TypeNode } from './pattern-tree-node/type-node';

//flags: U -> ungreedy, g -> global. percentages are escapable with a slash.
const argumentRegExp = /(?<!\\)\%(.*?)(?<!\\)\%/g;

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
		if (child.delimiter == '[') {
			fixedString += '(';
		}
		else if (child.delimiter == '(') {
			fixedString += child.delimiter;
		}
		else if (child.delimiter == '|') {
			if (child.start > hierarchy.start) {
				fixedString += child.delimiter;
			}
		}
		if (child.delimiter == '<') {
			fixedString += pattern.substring(child.start, child.end);
		}
		else {
			fixedString += convertSkriptPatternToRegExp(pattern, child);
		}
		if (child.delimiter == '[') {
			fixedString += ')?';
		}
		else if (child.delimiter == '(') {
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
				if (node.delimiter != '[' || char == ']') {
					node.end = i; //pop
					const linkedOpenbrace = openBraces[closingBraces.indexOf(char)];
					if (node.delimiter != linkedOpenbrace) {
						node = hierarchy.getActiveNode();
						if (node != hierarchy) {
							node.end = i; //pop twice (needed for pipes and if a brace was placed incorrectly)
						}
					}
				}
			}
			else if (node.delimiter != '[') {
				if (openBraces.includes(char)) {
					node.children.push(new SkriptNestHierarchy(i + 1, char));
				}
				else if (char == '|') {
					if (node.delimiter == '|') {
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
	if (lastActiveNode.delimiter == '|') {
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
		if (this.root) {
			for (const p of other.compatiblePatterns) {
				this.addToTree(p);
			}
		}
	}

	separateNodeChildren(oldChildren: Map<string, PatternTreeNode>, newChildren: Map<string, PatternTreeNode>) {
		for (const [key, child] of oldChildren) {
			newChildren.set(key, child);
			child.parentGroups.push(newChildren);
		}
	}

	/**clones the merged node onto the new node and assigns the new node as parent to the cloned child references */
	separateNode(mergedNode: PatternTreeNode, newNode: PatternTreeNode) {
		this.separateNodeChildren(mergedNode.stringOrderedChildren, newNode.stringOrderedChildren);
		this.separateNodeChildren(mergedNode.instanceTypeChildren, newNode.instanceTypeChildren);
		this.separateNodeChildren(mergedNode.staticTypeChildren, newNode.staticTypeChildren);
		this.separateNodeChildren(mergedNode.regExpOrderedChildren, newNode.regExpOrderedChildren);
		newNode.patternsEndedHere = [...mergedNode.patternsEndedHere];
	}


	//returns endnodes of the pattern parts
	//for example, this pattern has two endnodes:
	//send [the | % to the] player
	addPatternPart(data: PatternData, currentNodes: PatternTreeNode[], Hierarchy: SkriptNestHierarchy): PatternTreeNode[] {
		const pattern = data.regexPatternString;//.replace(/\\(.)/g, "$1");
		if (Hierarchy.children.length && Hierarchy.children[0].delimiter == '|') {
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
			let newNodes: PatternTreeNode[];
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
				else {
					newNodes = currentNodes;
				}
			}
			else {
				newNodes = [];

				interface MergedNodeData {
					/**the parent groups which referenced this node */
					newParentGroups: Map<string, PatternTreeNode>[];
					/**the key used to access the node in the parent groups. only one key, because the node always has the same key*/
					patternKey: string;
					/**newly created node, ready to use when necessary. */
					newNode: PatternTreeNode;
				};

				/** store the data of each merged node, in case conflicts arise, for example when the newly merged node doesn't have the same parents*/

				let dataByMergedNode: Map<PatternTreeNode, MergedNodeData> = new Map<PatternTreeNode, MergedNodeData>();

				/**only merge new nodes. */
				let mergedNode: PatternTreeNode | undefined = undefined;
				//for each possibility of this pattern, loop over the letters
				for (let splitNodeIndex = 0; splitNodeIndex < currentNodes.length; splitNodeIndex++) {
					const currentSplitNode = currentNodes[splitNodeIndex] as StringNode;

					/**checks if a node is present with this key. if not, and there's no merged node available, it creates a new node. */
					const addNode = (children: Map<string, PatternTreeNode>, key: string, nodeFunc: () => PatternTreeNode) => {
						/**the node already present with the correct key */
						const existingNode = children.get(key);
						if (existingNode == undefined) {
							//create a new node. we'll only create one new node, since everything that comes after this will connect.
							if (mergedNode == undefined) {
								mergedNode = nodeFunc();
								newNodes.push(mergedNode);
							}
							children.set(key, mergedNode);
							//add the current split node to the parents so:
							// when we use this node in another pattern, we can check if we're using the same parents.
							// and we can reorganize nodes later.
							mergedNode.parentGroups.push(children);
						}
						else {
							//use the existing node. when it has different parents than the new ones, a clone will be created
							let nodeData = dataByMergedNode.get(existingNode);
							if (!nodeData) {
								/**we can't pass the function, because it will be called later with a different context */
								nodeData = { newParentGroups: [], patternKey: key, newNode: nodeFunc() };
								dataByMergedNode.set(existingNode, nodeData);
								/**only add to newNodes if the node wasn't added yet */
								newNodes.push(existingNode);
							}
							nodeData.newParentGroups.push(children);
						}
					};

					//no double spaces
					if ((char == ' ') && ((currentSplitNode.patternKey == ' ')
						// or spaces at the start of the pattern
						//(we're not comparing index because then optional elements would possibly add spaces)
						|| currentSplitNode == this.root)) {
						//skip
						newNodes.push(currentSplitNode);
					}
					else if (char == '%') {
						//check which type this is

						let argumentIndex = 0;
						//find the argument index. this is also safe for if we want to access elements earlier
						//like when we first process the second %, then the first one
						let match;
						//declare regexp outside scope so it remembers lastindex
						let argumentRegexp = /(?<!\\)%/g;
						while ((match = argumentRegexp.exec(data.regexPatternString))) {
							if (match.index >= i) break;
							argumentIndex++;

						}
						if (argumentIndex < data.expressionArguments.length) {
							//let node = new TypeNode(data.expressionArguments[argumentIndex]);
							const typeState = data.expressionArguments[argumentIndex];
							for (const possibleType of typeState.possibleTypes) {
								//for debugger
								if (possibleType.section) {

									//literal
									if (!typeState.staticOnly)
										addNode(currentSplitNode.instanceTypeChildren, possibleType.skriptPatternString, () => new TypeNode(possibleType.section as SkriptTypeSection));
									addNode(currentSplitNode.staticTypeChildren, possibleType.skriptPatternString, () => new TypeNode(possibleType.section as SkriptTypeSection));
								}
							}
						}
					}
					//string node
					else {
						if (char == '\\') {
							//we can skip all checking and directly add this as string node
							i++;
							char = pattern[i];
						}
						addNode(currentSplitNode.stringOrderedChildren, char, () => new StringNode(char));
					}
				}
				//fix up the clutter
				//check if there are any nodes which have different parent nodes
				for (const [mergedNode, mergedNodeData] of dataByMergedNode) {
					const oldParentGroups = mergedNode.parentGroups;
					const newParentGroups = mergedNodeData.newParentGroups;
					// check if the nodes have the same parents. when they don't, they get split into 2 groups:

					let separatedNode = undefined;
					// the non-overlapping nodes get merged into one group. the new non overlapping nodes got taken care of already.
					// the overlapping nodes will not be edited except that some of their parent groups will get removed.
					for (let oldParentGroup of oldParentGroups) {
						//old parent might not be in the new parents
						//all new parents are in the old parents, because that's how they got these child nodes, from their old parents.
						if (!newParentGroups.includes(oldParentGroup)) {
							if (!separatedNode) {
								separatedNode = mergedNodeData.newNode;
								newNodes.push(separatedNode);
								//clone the node and keep all children
								this.separateNode(mergedNode, separatedNode);
							}
							//replace the shared node with the new node
							oldParentGroup.set(mergedNodeData.patternKey, separatedNode);
							separatedNode.parentGroups.push(oldParentGroup);
							oldParentGroups.splice(oldParentGroups.indexOf(oldParentGroup));
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

	static isRegexPattern(pattern: PatternData): boolean {
		return /\\d\+|(?<!\\)(\+|\*|\.)/.exec(pattern.regexPatternString) !== null;
	}

	//add a pattern to the tree
	private addToTree(pattern: PatternData): void {
		//for debugger
		if (this.root) {
			if (PatternTree.isRegexPattern(pattern)) {
				let node = new RegExpNode(new RegExp(pattern.regexPatternString));
				node.patternsEndedHere.push(pattern);
				this.root.regExpOrderedChildren.set(pattern.regexPatternString, node);
			}
			else {
				const regExpHierarchy = createRegExpHierarchy(pattern.regexPatternString);
				const endNodes = this.addPatternPart(pattern, [this.root], regExpHierarchy);
				for (const node of endNodes) {
					node.patternsEndedHere.push(pattern);
				}
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
					if (node.delimiter != '<' || char == '>') {

						const linkedOpenbrace = openBraces[closingBraces.indexOf(char)];
						if ((char == ')') && (node.delimiter == '[')) {
							//just ignore, this is a literal brace
							continue;
						}

						node.end = i; //pop
						if (node.delimiter != linkedOpenbrace) {
							const oldNode = node;
							node = hierarchy.getActiveNode();
							if (oldNode.delimiter == '(') {//this was a literal brace
								node.children = node.children.splice(0, node.children.length - 1);
								node.children.push(...oldNode.children);
							}
							if (node != hierarchy) {
								node.end = i; //pop twice (needed for pipes and if a brace was placed incorrectly)
							}
						}
					}
				}
				else if (node.delimiter != '<') {
					if (openBraces.includes(char)) {
						node.children.push(new SkriptNestHierarchy(i + 1, char));
					}
					else if (char == '|') {
						if (node.delimiter == '|') {
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
		if (lastActiveNode.delimiter == '|') {
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
			if (node.delimiter == '(') {
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

	static parsePattern(context: SkriptContext, patternSection: ReflectPatternContainerSection, type: PatternType): PatternData | undefined {
		const Hierarchy = this.createHierarchy(context);
		if (!context.parseResult.diagnostics.length) {
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
					context.addToken(TokenTypes.pattern, previousTokenEndPos, typeStart - previousTokenEndPos, TokenModifiers.definition);
					const result = context.currentSection.parseTypes(context, typeStart, typeString.length);
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
			context.addToken(TokenTypes.pattern, previousTokenEndPos, undefined, TokenModifiers.definition);
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
		//these patterns are not compatible with the tree
		//these patterns are roughly always patterns which we don't need anyways, because they don't provide intelligent support.
		//for example: expr-1 shouldn't be available in each context
		//the loop-value shouldn't be available in each context either
		//etc.
		if (!PatternTree.isRegexPattern(pattern)
			//when defined by intelliskript, the pattern should be safe to use
			|| pattern.definitionLocation.uri.includes('IntelliSkript.sk')) {
			this.compatiblePatterns.push(pattern);
			if (this.root) {
				this.addToTree(pattern);
			}
		}
		//if (pattern.skriptPatternString[0] == '<' && pattern.skriptPatternString[pattern.skriptPatternString.length - 1] == '>') {
		//	//most of these patterns aren't actually used in our code
		//	//if(pattern.regexPatternString.includes('\\d+'))
		//	this.incompatiblePatterns.push(pattern);
		//}
		else {
		}
	}
}