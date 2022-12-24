import { DiagnosticSeverity } from 'vscode-languageserver';
import { Location } from 'vscode-languageserver/node';
import { SkriptNestHierarchy } from '../Nesting/SkriptNestHierarchy';
import type { SkriptPatternContainerSection } from '../Skript/Section/Reflect/SkriptPatternContainerSection';
import { SkriptContext } from '../Skript/SkriptContext';
import { SkriptTypeState } from "../Skript/SkriptTypeState";
import { PatternData } from './PatternData';
import { PatternTreeElement } from './PatternTreeElement';
import { RegExpTreeError } from './RegExpTreeError';
import { PatternResultProcessor } from './patternResultProcessor';
import { PatternMatcher } from './PatternMatcher';
import { SkriptPatternCall } from './SkriptPattern';
import { TokenTypes } from '../TokenTypes';
import { PatternType } from './PatternType';
import assert = require('assert');

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
	root: PatternTreeElement | undefined;
	incompatiblePatterns: PatternData[] = [];
	compatiblePatterns: PatternData[] = [];

	merge(other: PatternTree): void {
		this.incompatiblePatterns.push(...other.incompatiblePatterns);
		this.compatiblePatterns.push(...other.compatiblePatterns);
	}

	private addToTree(data: PatternData): void {
		const regExpHierarchy = createRegExpHierarchy(data.regexPatternString);
		assert(this.root != undefined);
		const endNodes = this.root.addPatternPart(data.regexPatternString, [this.root], regExpHierarchy);
		for (const node of endNodes) {
			node.endNode = data;
		}
	}
	compile(): void {
		this.root = new PatternTreeElement();
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

		const lastActiveNode = hierarchy.getActiveNode();
		if (lastActiveNode != hierarchy) {
			context.addDiagnostic(lastActiveNode.start, 1, "no matching closing character found", DiagnosticSeverity.Error, "IntelliSkript->Nest->No Matching");
		}
		hierarchy.end = context.currentString.length;
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
			while ((m = argumentRegExp.exec(context.currentString))) {
				assert(m.index != undefined);
				const typeString = m[1];

				const result = context.currentSection.parseTypes(context, m.index + 1, m.index + 1 + m[1].length);
				context.addToken(TokenTypes.type, m.index + 1, typeString.length);
				if (result) {
					expressionArguments.push(result);
				}
				else {
					context.addDiagnostic(m.index + 1, typeString.length, "this type is not recognized", DiagnosticSeverity.Error, "IntelliSkript->Type->Not Recognized");
					const obj = context.currentSection.getTypeData('object');
					if (obj) {
						expressionArguments.push(new SkriptTypeState(obj));
					}
					else {
						shouldReturn = true;
					}
				}
			}
			if (shouldReturn) return;

			let fixedString = convertSkriptPatternToRegExp(context.currentString, Hierarchy);

			try {
				fixedString = fixedString.trim();

				let regExpHierarchy: SkriptNestHierarchy;


				fixedString = fixedString.replace(argumentRegExp, '%');

				regExpHierarchy = createRegExpHierarchy(fixedString);
				fixedString = this.fixRegExpHierarchically(fixedString, regExpHierarchy);
				regExpHierarchy = createRegExpHierarchy(fixedString);

				const data = new PatternData(context.currentString, fixedString, Location.create(context.currentDocument.uri, {
					start: context.currentDocument.positionAt(context.currentPosition),
					end: context.currentDocument.positionAt(context.currentPosition + context.currentString.length)
				}), expressionArguments, type, patternSection);
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
		const data = this.root.getMatchingPatternPart(testPattern.pattern, 0);
		if (data) {
			if (testPattern.compareArgumentTypes(data)) {
				if (!shouldContinue(data)) {
					return data;
				}
			}
		}
		for (const pattern of this.incompatiblePatterns) {
			if (testPattern.compare(pattern) && (!shouldContinue(pattern))) {
				return pattern;
			}
		}
	}
}