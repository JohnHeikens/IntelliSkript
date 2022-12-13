import { SkriptNestHierarchy } from './Nesting/SkriptNestHierarchy';
import { SkriptPatternContainerSection } from './Skript/Section/Reflect/SkriptPatternContainerSection';
import { SkriptContext } from './Skript/SkriptContext';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { Location } from 'vscode-languageserver/node';

export type patternResultProcessor = (patternFound: PatternData) => boolean;

function removeDuplicates<T>(array: T[]): T[] {
	return array.filter((value, index) => array.indexOf(value) === index);
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

export class PatternData {
	definitionLocation: Location;
	section: SkriptPatternContainerSection;
	skriptPatternString: string;
	regexPatternString: string;
	patternRegExp: RegExp;
	constructor(skriptPatternString: string, regexPatternString: string, definitionLocation: Location, section: SkriptPatternContainerSection) {
		this.skriptPatternString = skriptPatternString;
		this.regexPatternString = regexPatternString;
		this.patternRegExp = new RegExp(regexPatternString);
		this.definitionLocation = definitionLocation;
		this.section = section;
		//check if the pattern is a wildcard
		//const h = createRegExpHierarchy(this.regexPatternString);
		//remove optional parts
		//let wildCardCheckString = '';
		//let currentPosition = 0;
		//for(let i = 0; i < h.children.length; i++)
		//{
		//	if(h.children[i].character == '('){
		//		wildCardCheckString += skriptPatternString.substring(currentPosition, h.children[i].start - 1);
		//		currentPosition = h.children[i].end + 1;
		//	}
		//}
	}
}

export class RegExpTreeError extends Error {
	position?: number;
	constructor(message: string, position?: number) {
		super(message);
		this.position = position;
	}
}

export class PatternTreeElement {
	children: Map<string, PatternTreeElement> = new Map<string, PatternTreeElement>();
	endNode?: PatternData;
	patternKey?: string;
	constructor(patternKey?: string) {
		this.patternKey = patternKey;
	}

	getMatchingPatternPart(pattern: string, index: number): PatternData | undefined {
		if (this.endNode) {// && (index == (pattern.length))) {
			if(index == pattern.length || (pattern[index + 1] == ' ')){
				return this.endNode;
			}
		}
		const currentChar = pattern[index];
		const charChild = this.children.get(currentChar);
		if (charChild) {
			const charChildMatchResult = charChild.getMatchingPatternPart(pattern, index + 1);
			if (charChildMatchResult) return charChildMatchResult;
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
						i = node.end + 1;//+1 but the +1 gets added in the loop already
					}
					else {
						newElements = optionEnds;
						i = node.end;//+1 but the +1 gets added in the loop already
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
}


export class PatternTree extends PatternTreeElement {
	incompatiblePatterns: PatternData[] = [];




	createHierarchy(context: SkriptContext): SkriptNestHierarchy {
		const openBraces = "([<";//< starts a regular expression, we don't have to create a hierarchy in there
		const closingBraces = ")]>";
		const hierarchy = new SkriptNestHierarchy(0, '');

		for (let i = 0; i < context.currentString.length; i++) {
			const char = context.currentString[i];
			if ((openBraces + closingBraces + '|\\').includes(char)) {
				let node = hierarchy.getActiveNode();
				if (closingBraces.includes(char)) {
					if (node.character != '<' || char == '>') {

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

		const lastActiveNode = hierarchy.getActiveNode();
		if (lastActiveNode != hierarchy) {
			context.addDiagnostic(lastActiveNode.start, 1, "no matching closing character found", DiagnosticSeverity.Error, "IntelliSkript->nest->no matching");
		}
		hierarchy.end = context.currentString.length;
		return hierarchy;
	}

	convertToRegExp(pattern: string, hierarchy: SkriptNestHierarchy): string {
		function convertString(input: string): string {
			const replaceRegex = /\?|\+|\*|\/|\./;
			return input.replace(replaceRegex, "\\$1");
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
				fixedString += this.convertToRegExp(pattern, child);
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
		return fixedString;
		//let fixedString = pattern.substring(hierarchy.start, hierarchy.children[
	}

	addPattern(context: SkriptContext, pattermSectop: SkriptPatternContainerSection) {


		const Hierarchy = this.createHierarchy(context);
		if (!context.hasErrors) {
			let fixedString = this.convertToRegExp(context.currentString, Hierarchy);

			try {
				fixedString = fixedString.trim();

				let regExpHierarchy;

				//flags: U -> ungreedy, g -> global
				fixedString = fixedString.replace(/%.*?%/g, '%');

				fixLoop:
				for (; ;) {
					regExpHierarchy = createRegExpHierarchy(fixedString);
					for (let i = 0; i < fixedString.length; i++) {
						if (fixedString[i] == '(') {
							//optional
							const node = regExpHierarchy.getChildNodeStartAt(i + 1);
							if (node) {
								//this is an optional segment. the space should only be added if the option is chosen.
								//for example:
								//in (the)? bus -> in( the)? bus
								//(in)? the bus -> (in )? the bus
								//(in )?(the)? bus -> (in )?(the )?bus
								//(in )?(the )? bus -> (in )?(the  )? bus -> (in )? (the )? bus
								if (fixedString[node.end + 1] == '?') {
									let newFixedString;
									const spaceLeft = fixedString[i - 1] == ' ';
									const endPos = node.end + 2;
									const spaceRight = fixedString[endPos] == ' ';
									const startLeft = ((i == 0) || fixedString[i - 1] == '^');
									if (spaceRight && (spaceLeft || startLeft)) {
										fixedString = fixedString.substring(0, node.end) + " )?" + fixedString.substring(endPos + 1);
										continue fixLoop;//recalculate hierarchy
									}
									else {
										if (spaceLeft) {
											const endRight = ((endPos) == fixedString.length) || fixedString[endPos] == '$';
											if (endRight || !spaceRight) {
												//incorrect regex, move the brace 1 place
												//test [so+-+me] thing -> test( some)? thing
												newFixedString = fixedString.substring(0, i - 1) + '( ' + fixedString.substring(node.start);
												fixedString = newFixedString;
												continue fixLoop;//recalculate hierarchy
											}
										}
									}
								}
								//else {
								//	newFixedString = fixedString.substring(0, i - 1) + '(' + fixedString.substring(node.start);
								//}
							}
						}
						//else if (fixedString[i] == '<') {
						//	//regex -> remove braces since this is a regex already
						//	const node = regExpHierarchy.getChildNodeStartAt(i + 1);
						//	if (node) {
						//		fixedString = fixedString.substring(0, node.start - 1) + fixedString.substring(node.start, node.end) + fixedString.substring(node.end + 1);
						//	}
						//}
					}
					break;
				}

				//fixedstring can't be edited as the hierarchy can't be recalculated

				const data = new PatternData(context.currentString, fixedString, Location.create(context.currentDocument.uri, {
					start: context.currentDocument.positionAt(context.currentPosition),
					end: context.currentDocument.positionAt(context.currentPosition + context.currentString.length)
				}), pattermSectop);
				if (context.currentString == "expr-<[0-9]+>") {
					for (let i = 0; i < 2; i++) {
						i += 1;
					}
				}
				if (/\d\+|(?<!\\)(\+|\*)/.exec(fixedString)) {
					//regex is not compatible with the tree
					this.incompatiblePatterns.push(data);
				} else {
					const endNodes = this.addPatternPart(fixedString, [this], regExpHierarchy);
					for (const node of endNodes) {
						node.endNode = data;
					}
				}
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
	}


	getMatchingPatterns(testString: string, shouldContinue: patternResultProcessor): PatternData | undefined {
		const data = super.getMatchingPatternPart(testString, 0);
		if (data) {
			if (!shouldContinue(data)) {
				return data;
			}
		}
		for (const pattern of this.incompatiblePatterns) {
			if (pattern.patternRegExp.test(testString) && (!shouldContinue(pattern))) {
				return pattern;
			}
		}

	}
}