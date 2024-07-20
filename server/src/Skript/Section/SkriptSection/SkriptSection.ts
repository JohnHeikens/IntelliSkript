import { DiagnosticSeverity, integer, Location } from 'vscode-languageserver/node';
import { SkriptNestHierarchy } from '../../../nesting/SkriptNestHierarchy';
//import { PatternData } from "../../pattern/PatternData";
import { PatternData, TypeData } from '../../../pattern/data/PatternData';
import { PatternType } from "../../../pattern/PatternType";
import { SkriptPatternCall } from '../../../pattern/SkriptPattern';
import { TokenModifiers } from '../../../TokenModifiers';
import { TokenTypes } from '../../../TokenTypes';
import { SkriptVariable } from '../../storage/SkriptVariable';
import { SkriptTypeState } from '../../storage/type/SkriptTypeState';
import { SkriptContext } from '../../validation/SkriptContext';
import { SkriptSectionGroup } from '../SkriptSectionGroup';
import { TransformedPattern } from './PatternToLineTransform';
//import { SkriptConditionSection } from './SkriptConditionSection';
import assert = require('assert');
//import { createBasicSection } from './CreateBasicSection';
//const variablePattern = /\{(.*)\}/g;
//IMPORT BELOW TO AVOID CIRCULAR DEPENDENCIES

//declare class SkriptConditionSection extends SkriptSection {
//	constructor(parent: SkriptSection, context: SkriptContext);
//}
//declare function createBasicSection(context: SkriptContext, parentSection: SkriptSection): SkriptSection;
export class SkriptSection extends SkriptSectionGroup {
	static readonly patternType: PatternType = PatternType.condition;
	startLine: number;
	endLine: number;
	override children: SkriptSection[] = [];

	constructor(parent: SkriptSectionGroup, context?: SkriptContext) {
		super(parent);
		this.startLine = context?.currentLine ?? 0;
		this.endLine = this.startLine;
	}

	/**
	 * this function will be called when the full section is parsed. it's used to add the patterns of pattern container sections, for example
	 */
	finish(context: SkriptContext) {

	}

	//go up first, then iterate downwards
	override getVariableByName(name: string): SkriptVariable | undefined {
		for (const variable of this.definedVariables) {
			if (variable.overlap(name))//regexes overlap, could be the same variable
			{
				return variable;
			}
		}
		if (this.parent != undefined) {
			return this.parent.getVariableByName(name);
		}
		return undefined;
	}

	addVariableReference(referenceLocation: Location, name: string): SkriptVariable {
		const existingVariable = this.getVariableByName(name);
		if (existingVariable) {
			return existingVariable;
		}
		else {
			const newVariable = new SkriptVariable(referenceLocation, name);
			this.definedVariables.push(newVariable);
			return newVariable;
		}
	}

	getTypeData(typeName: string): TypeData | undefined {
		return this.getPatternData(new SkriptPatternCall(typeName, PatternType.type))?.fullMatch.matchedPattern;
	}
	getParentSection(): SkriptSection | undefined {
		return this.parent && this.parent instanceof SkriptSection ?
			this.parent :
			undefined;
	}

	parseType(context: SkriptContext, start = 0, end = context.currentString.length): TypeData | undefined {
		const data = this.getTypeData(context.currentString.substring(start, end));
		let modifiers: TokenModifiers[] = [];
		if (data) {
			context.addPatternMatch(data, start, end);
		}
		else {
			modifiers.push(TokenModifiers.deprecated);
			context.addDiagnostic(start, end - start, "cannot recognize type", DiagnosticSeverity.Error);
		}
		context.addToken(TokenTypes.type, start, end - start, modifiers);
		return data;
	}

	/**will add a type token! */
	parseTypes(context: SkriptContext, start = 0, end = context.currentString.length): SkriptTypeState | undefined {
		const str = context.currentString.substring(start, end);
		const result = new SkriptTypeState();
		let parts: string[];
		let currentPosition = start;
		if (str[0] == '*') {
			result.isLiteral = true;
			currentPosition++;
			parts = str.substring(1).split('/');
		}
		else if (str[0] == '-') {
			result.canBeEmpty = true;
			currentPosition++;
			parts = str.substring(1).split('/');
		}
		else {
			parts = str.split('/');
		}
		for (let i = 0; i < parts.length; currentPosition += (parts[i].length + '/'.length), i++) {
			const modifiers: TokenModifiers[] = [];
			let typePattern: TypeData | undefined;
			if (parts[i].endsWith('s')) {
				const singleType = parts[i].substring(0, parts[i].length - 1);
				typePattern = this.getTypeData(singleType);
				if (typePattern) {
					result.isArray = true;
				}
			}
			if (!typePattern)
				typePattern = this.getTypeData(parts[i]);
			//error 'type not recognized' has been added by the getPatternData function already

			if (typePattern) {
				result.possibleTypes.push(typePattern);
				context.addPatternMatch(typePattern, currentPosition, currentPosition + parts[i].length);
			} else
				modifiers.push(TokenModifiers.deprecated);

			context.addToken(TokenTypes.type, currentPosition, parts[i].length, modifiers);
			//else {
			//	//error 'type not recognized' has been added by the getPatternData function already
			//	return undefined;
			//}
		}
		return result;
	}

	/**
	 * 
	 * @param context 
	 * @param pattern 
	 * @param match 
	 * @param matchPatternStart the start of the match, relative to the pattern
	 * @param matchPatternEnd the end of the match, relative to the pattern
	 */
	private tokenizeMatch(context: SkriptContext, pattern: TransformedPattern, match: PatternData, matchPatternStart: integer = 0, matchPatternEnd: integer = pattern.pattern.length) {
		const tokenType = //match.section instanceof SkriptPropertySection ?
			match.patternType == PatternType.event ? TokenTypes.event :
				match.returnType.possibleTypes.length ?
					TokenTypes.property :
					TokenTypes.method;

		/**the point in the pattern to start tokenizing from. will move to the end of submatches if there are any*/
		let tokenizeFrom = matchPatternStart;
		/**the last found position of a '%' */
		let subMatchPatternPos = -1;

		while (true) {
			// send % to % parsed as % <-- match for '% parsed as %'
			// add tokens for each part of the pattern that wasn't replaced already (aka passed as '%')
			// tokenize ' parsed as '
			// start = 10

			//we can't just use the keypoints, because we'll never know if we will replace something else using keypoints, or if a submatch was of length 1.
			//so instead, let's tokenize everything which isn't a '%'
			subMatchPatternPos = pattern.pattern.indexOf('%', subMatchPatternPos + 1);
			//there is no new submatch within our reach
			if (subMatchPatternPos == -1 || subMatchPatternPos > matchPatternEnd) break;
			const tokenLength = subMatchPatternPos - tokenizeFrom;
			if (tokenLength >= 0) {
				const subMatchLinePos = pattern.getLinePos(subMatchPatternPos);
				if (context.currentString[subMatchLinePos] != '%') {
					//this is not a real, but a replaced '%'
					if (tokenLength > 0) {
						//tokenize the submatch
						context.addToken(tokenType, pattern.getLinePos(tokenizeFrom), tokenLength);
					}
					tokenizeFrom = subMatchPatternPos + 1;
				}
			}
		}
		if (matchPatternEnd > tokenizeFrom)
			//finally, tokenize the part of the match that wasn't tokenized yet
			context.addToken(tokenType, pattern.getLinePos(tokenizeFrom), matchPatternEnd - tokenizeFrom);
	}

	/**visualizes matches recursively */
	private visualizeMatch(context: SkriptContext, pattern: TransformedPattern, currentMatch: PatternMatch) {
		let currentPatternPos = currentMatch.start;
		const separatorWidth = 1;
		for (const subMatch of currentMatch.children) {
			const segmentEnd = subMatch.start - separatorWidth;
			const distance = segmentEnd - currentPatternPos;
			if (distance > 0) {
				this.tokenizeMatch(context, pattern, currentMatch.matchedPattern, currentPatternPos, segmentEnd);
			}
			this.visualizeMatch(context, pattern, subMatch);
			currentPatternPos = subMatch.end + separatorWidth;
		}
		const distance = currentMatch.end - currentPatternPos;
		if (distance > 0) {
			this.tokenizeMatch(context, pattern, currentMatch.matchedPattern, currentPatternPos, currentMatch.end);
		}
		context.addPatternMatch(currentMatch.matchedPattern, pattern.getLinePos(currentMatch.start), pattern.getLinePos(currentMatch.end));
	}

	//detect patterns like a [b | c]
	//return value: a type. basically, it will convert each subpattern into a result type (a %)
	detectPatternsRecursively(context: SkriptContext, mainPatternType: PatternType = PatternType.effect, isTopNode = true, currentNode: SkriptNestHierarchy = context.createHierarchy(true)): { detectedPattern: PatternData | undefined } {
		let foundPattern: PatternData | undefined;
		const mergedPatternArguments: Map<number, SkriptTypeState> = new Map<number, SkriptTypeState>();
		//const currentNode = isTopNode ? context.createHierarchy(isTopNode) : context.hierarchy;

		//this transform will make errors and go-to-definition links appear at the right place
		const pattern = new TransformedPattern(context.currentString);

		//number types are defined too and just return 'number'. the only thing we're doing here is coloring the numbers differently.
		//detect numbers (like '2') and convert them to types (%)
		//const convertLiteralsToSymbols = ((lineStart: number, lineEnd: number) => {
		//	let m: RegExpMatchArray | null;
		//	const numberGlobalRegExp = new RegExp(IntelliSkriptConstants.NumberRegExp, "g");
		//	//let outString = '';
		//	//let lastPosition: integer = 0;
		//	while ((m = numberGlobalRegExp.exec(context.currentString.substring(lineStart, lineEnd)))) {
		//		//for the debugger
		//		if (m.index !== undefined) {
		//
		//			const numberData = this.getTypeData("number");
		//			if (numberData) {
		//				mergedPatternArguments.set(m.index, new SkriptTypeState(numberData));
		//				context.addToken(TokenTypes.number, pattern.getLinePos(lineStart + m.index), m[0].length);
		//			}
		//			pattern.replace(lineStart + m.index, lineStart + m.index + m[0].length);
		//			//replace with '%'
		//			//outString += input.substring(lastPosition, m.index) + '%';
		//			//pattern.keypoints.push({ patternPos: outString.length + m.index, linePos: start + m.index })
		//		}
		//	}
		//	//const booleanGlobalRegExp = new RegExp(IntelliSkriptConstants.BooleanRegExp, "g");
		//	//while ((m = booleanGlobalRegExp.exec(input))) {
		//	//	patternArguments.set(m.index, new SkriptTypeState(this.getTypeData("boolean")));
		//	//	context.addToken(TokenTypes.enum, start + m.index, m[0].length);
		//	//}
		//
		//	//const result = input.replace(numberGlobalRegExp, '%');
		//	//result = result.replace(booleanGlobalRegExp, '%');
		//	//return result;
		//});

		//loop over sentence and try to replace as much as possible
		//add the change value to {_test} -> add the change value to % -> add % to %

		//const results: TypeData[] = [];
		const childResultList: PatternData[] = new Array(currentNode.children.length);

		//first: process all child nodes
		for (let i = 0; i < currentNode.children.length; i++) {
			//for (const currentChild of currentNode.children) {
			const nodeToClone = currentNode.children[i];
			//make the hierarchy relative to the node
			const offsetNode = nodeToClone.cloneWithOffset(-nodeToClone.start);

			const childResults = this.detectPatternsRecursively(context.push(nodeToClone.start, nodeToClone.end - nodeToClone.start), PatternType.expression, false, offsetNode);
			if (childResults.detectedPattern)
				childResultList[i] = childResults.detectedPattern;

		}
		//then process main node
		//will also return true if currentNode.character is ''
		if ('%('.includes(currentNode.character)) {
			//let mergedPattern = '';
			//the position in the pattern
			//let currentPosition = currentNode.start;

			//pattern = pattern.replace(/\{.*\}/g, '%');

			for (let i = 0; i < currentNode.children.length; i++) {
				const child = currentNode.children[i];
				if ('"{('.includes(child.character)) {//string or variable
					let typeToReplace: SkriptTypeState | undefined;
					if (child.character == '(') {
						if (childResultList[i])
							mergedPatternArguments.set(child.start, childResultList[i].returnType);
						else {
							//check if this is a function
							//search to the left (to where the name would end)
							const functionNameRegex = /(?:([a-zA-Z_]{1,})\.)?([a-zA-Z_][a-zA-Z0-9_]{1,})$/g;
							const functionNameEnd = child.start - 1;
							let match;
							if (match = functionNameRegex.exec(context.currentString.substring(0, functionNameEnd))) {
								//TODO: search for functions
								if (match[1])
									context.addToken(TokenTypes.namespace, match.index, match[1].length);
								context.addToken(TokenTypes.function, functionNameEnd - match[2].length, match[2].length);
								pattern.replace(match.index, child.end + 1);
								const objectData = this.getTypeData("unknown");
								if (objectData) {
									mergedPatternArguments.set(child.start, new SkriptTypeState(objectData));
								}
							}
							continue;
						}
					}
					else if (child.character == '{') {
						//variable
						this.addVariableReference(context.getLocation(child.start, child.end - child.start), context.currentString.substring(child.start, child.end));
						//context.addToken(variable.isParameter ? TokenTypes.parameter : TokenTypes.variable, child.start, child.end - child.start);

					}
					else if (child.character == '"') {
						const stringData = this.getTypeData("string");
						if (stringData)
							mergedPatternArguments.set(child.start, new SkriptTypeState(stringData));
					}
					if (!typeToReplace) {
						const objectData = this.getTypeData("unknown");
						if (objectData) {
							typeToReplace = new SkriptTypeState(objectData);
						}
					}
					if (typeToReplace)
						mergedPatternArguments.set(child.start, typeToReplace);

					//convertLiteralsToSymbols(currentPosition, child.start);
					pattern.replace(child.start - 1, child.end + 1);
					//currentPosition = child.end + 1;
				}
			}
			//convertLiteralsToSymbols(currentPosition, currentNode.end);
			//now the merged pattern is complete.
			// example:
			// set {_belowLocation} to location of event-block
			// becomes:
			// set % to location of event-block



			//pattern arguments sorted by key (their offset)
			let currentPatternArguments = Array.from(mergedPatternArguments.entries()).
				sort(([keyA], [keyB]) => keyA - keyB).//sort
				map(([, value]) => value);//erase keys

			if (!isTopNode && currentPatternArguments.length == 1 && pattern.pattern.length == 1) {
				//this pattern is just '%'. we should pass it to the pattern detector above
			}
			else {

				//pass pattern by reference
				const matchResult = this.getPatternData(new SkriptPatternCall(pattern.pattern, mainPatternType, currentPatternArguments));// context, mainPatternType, pattern, currentPatternArguments);

				if (matchResult) {
					foundPattern = matchResult.fullMatch.matchedPattern;
					this.visualizeMatch(context, pattern, matchResult.fullMatch);
				}
				else if (isTopNode) {
					context.addDiagnostic(currentNode.start, currentNode.end - currentNode.start, "can't understand this line (pattern detection is a work in progress. please report on discord)", DiagnosticSeverity.Hint, "IntelliSkript->Pattern");
				}
			}
		}
		//won't pass for '' because it's being handled above
		else if ('"{'.includes(currentNode.character)) {
			const borderSize = currentNode.character == '"' ? 1 : 0;
			const tokenType = currentNode.character == '"' ? TokenTypes.string : TokenTypes.variable;

			//just tokenize around the already processed child nodes
			let currentPosition = currentNode.start - borderSize;

			for (let i = 0; i < currentNode.children.length; i++) {
				{
					//we don't have to do anything with the results of the children (the %%'es)
					const child = currentNode.children[i];
					context.addToken(tokenType, currentPosition, child.start - currentPosition);
					currentPosition = child.end;
				}
			}
			context.addToken(tokenType, currentPosition, currentNode.end + borderSize - currentPosition);
		}
		return { detectedPattern: foundPattern };
	}

	processLine(context: SkriptContext): void {

		//let p: RegExpExecArray | null;
		//detect all variables in this line and create a hierarchy of for example opening and closing braces:
		// hi[er(ar|ch)]y
		this.detectPatternsRecursively(context);
		//const results = this.detectPatternsRecursively(context, context.hierarchy);
		////start fitting all the results in a hierarchy
		//if (results.length) {
		//	const h = new SkriptPatternMatchHierarchy(0, context.currentString.length);
		//	for (const result of results) {
		//		//this method assumes that nodes don't overlap
		//		const parentNode = h.getDeepestChildNodeAt(result.start);
		//		parentNode.children.push(result);
		//	}
		//	context.currentSkriptFile?.matches.children.push(h);
		//}


	}
	createSection(context: SkriptContext): SkriptSection | undefined {
		const checkPattern = /check \[(?!\()/g;
		let p: RegExpExecArray | null;
		let isIfStatement = false;
		while ((p = checkPattern.exec(context.currentString))) {
			const braceEndIndex = p.index + "check [".length;
			const node = context.hierarchy?.getChildNodeAt(braceEndIndex); // without the brace because we need to check the brace
			if (node && node.start == braceEndIndex) {
				context.addDiagnostic(
					p.index + "check [".length,
					node.end - node.start,
					`add braces around here to increase skript(re) load performance`, DiagnosticSeverity.Information, "IntelliSkript->Performance->Braces->Lambda");
				isIfStatement = true;
			}
		}


		if (context.currentString.startsWith("loop ")) {
			context.addToken(TokenTypes.keyword, 0, "loop ".length);
			return new SkriptLoopSection(this, context.push("loop ".length));
		}
		let section = new SkriptConditionSection(this, context);
		const ifStatementStartPatterns: string[] = ['if ', 'else if '];
		for (const pattern of ifStatementStartPatterns) {
			if (context.currentString.startsWith(pattern)) {
				context.addToken(TokenTypes.keyword, 0, pattern.length);
				section.detectPatternsRecursively(context.push(pattern.length), PatternType.condition);
				return section;
			}
		}
		if (context.currentString == 'else') {
			context.addToken(TokenTypes.keyword, 0, 'else'.length);
		}
		else {
			const result = section.detectPatternsRecursively(context, PatternType.condition);
			if (!result.detectedPattern) return undefined;
		}
		//try to find a (condition) pattern
		return section;

	}
	getExactSectionAtLine(line: number): SkriptSection {
		const childSection = this.getChildSectionAtLine(line);
		return childSection == undefined ? this : childSection.getExactSectionAtLine(line);
	}
	getChildSectionAtLine(line: number): SkriptSection | undefined {
		for (let i = 0; i < this.children.length; i++) {
			if (line >= this.children[i].startLine && line <= this.children[i].endLine) {
				return this.children[i];
			}
		}
		return undefined;
	}
}

import { PatternMatch } from '../../../pattern/match/PatternMatch';
import { SkriptLoopSection } from '../SkriptLoopSection';

export class SkriptConditionSection extends SkriptSection {
	constructor(parent: SkriptSection, context: SkriptContext) {
		super(parent, context);
	}

}