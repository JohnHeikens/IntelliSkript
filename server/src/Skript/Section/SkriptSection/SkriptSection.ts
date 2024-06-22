import { DiagnosticSeverity, integer, Location, Position } from 'vscode-languageserver/node';
import * as IntelliSkriptConstants from '../../../IntelliSkriptConstants';
import { SkriptNestHierarchy } from '../../../nesting/SkriptNestHierarchy';
//import { PatternData } from "../../pattern/PatternData";
import { PatternResultProcessor, stopAtFirstResultProcessor } from '../../../pattern/patternResultProcessor';
import { TokenTypes } from '../../../TokenTypes';
import { PatternType } from "../../../pattern/PatternType";
import { SkriptContext } from '../../SkriptContext';
import { SkriptVariable } from '../../SkriptVariable';
import { SkriptSectionGroup } from '../SkriptSectionGroup';
//import { SkriptConditionSection } from './SkriptConditionSection';
import assert = require('assert');
import { PatternData, TypeData } from '../../../pattern/data/PatternData';
import { SkriptPatternCall } from '../../../pattern/SkriptPattern';
import { SkriptTypeState } from '../../SkriptTypeState';
import { TokenModifiers } from '../../../TokenModifiers';
import { PatternKeyFrame, TransformedPattern } from './PatternToLineTransform'
//import { createBasicSection } from './CreateBasicSection';
//const variablePattern = /\{(.*)\}/g;
//IMPORT BELOW TO AVOID CIRCULAR DEPENDENCIES

//declare class SkriptConditionSection extends SkriptSection {
//	constructor(parent: SkriptSection, context: SkriptContext);
//}
//declare function createBasicSection(context: SkriptContext, parentSection: SkriptSection): SkriptSection;
export class SkriptSection extends SkriptSectionGroup {
	startLine: number;
	endLine: number;
	override children: SkriptSection[] = [];

	constructor(parent: SkriptSectionGroup, context?: SkriptContext) {
		super(parent);
		this.startLine = context?.currentLine ?? 0;
		this.endLine = this.startLine;
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
		return this.getPatternData(new SkriptPatternCall(typeName, PatternType.type), stopAtFirstResultProcessor);
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
				typePattern = this.getPatternData(new SkriptPatternCall(singleType, PatternType.type), stopAtFirstResultProcessor);
				if (typePattern) {
					result.isArray = true;
				}
			}
			if (!typePattern)
				typePattern = this.getPatternData(new SkriptPatternCall(parts[i], PatternType.type), stopAtFirstResultProcessor);
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


	private tokenizeMatch(context: SkriptContext, pattern: TransformedPattern, match: PatternData, subPatternStart: integer = 0, subPatternEnd: integer = pattern.pattern.length) {
		const tokenType = //match.section instanceof SkriptPropertySection ?
			match.patternType == PatternType.event ? TokenTypes.event :
				match.returnType.possibleTypes.length ?
					TokenTypes.property :
					TokenTypes.method;

		let lastKeyPoint: PatternKeyFrame = { linePos: pattern.getLinePos(subPatternStart), patternPos: subPatternStart };
		// send % to % parsed as % <-- match for '% parsed as %'
		// tokenize ' parsed as '
		// start = 10
		for (let keyPoint of pattern.keypoints) {
			const patternPartEnd = (keyPoint.patternPos - 1);
			if (patternPartEnd > subPatternEnd) {
				break;
			}
			const distanceInPattern = patternPartEnd - lastKeyPoint.patternPos;
			if (distanceInPattern >= 0) {
				if (distanceInPattern > 0) {
					context.addToken(tokenType, lastKeyPoint.linePos, distanceInPattern);
				}
				lastKeyPoint = keyPoint;
			}
		}
		context.addToken(tokenType, lastKeyPoint.linePos, subPatternEnd - lastKeyPoint.patternPos);
	}

	segmentatePattern(context: SkriptContext, mainPatternType: PatternType, fullPattern: TransformedPattern, patternArguments: SkriptTypeState[]): PatternData | undefined {
		let foundPattern: PatternData | undefined;
		const patternProcessor: PatternResultProcessor = (pattern: PatternData) => {
			//this pattern includes a wildcard
			if (/(\(.*\)\?)?\.\+/.test(pattern.regexPatternString)) {
				return true;
			}
			else {
				return false;//found
			}
		};
		const separatorIndexes: integer[] = [];
		let matchResult;
		//this regex will be modified, as it stores how far it searched.
		const separatorRegex = / |'/g;
		while ((matchResult = separatorRegex.exec(fullPattern.pattern)) !== null) {
			separatorIndexes.push(matchResult.index);
		}
		// loop over the pattern and try different ways of ordering the same pattern
		const fullPatternSegmentcount = separatorIndexes.length + 1;


		for (let patternSegmentCount = fullPatternSegmentcount; patternSegmentCount > 0; patternSegmentCount--) {
			// first try to find big patterns, then smaller and smaller
			// for example:
			// set % to location of event-block
			// segment count: 6 -> 5 -> 4 -> ...

			const lastStartSegment = fullPatternSegmentcount - patternSegmentCount;
			for (let startSegmentIndex = lastStartSegment; startSegmentIndex >= 0; startSegmentIndex--) {
				const subPatternStart = startSegmentIndex == 0 ? 0 : separatorIndexes[startSegmentIndex - 1] + 1;
				const endSeparatorIndex = (startSegmentIndex - 1) + patternSegmentCount;
				const subPatternEnd = endSeparatorIndex == separatorIndexes.length ? fullPattern.pattern.length : separatorIndexes[endSeparatorIndex];
				// the inner loop removes from the front and adds to the back
				// for example:
				// segment count: 4
				// location of event-block
				// % to location of
				// set % to location
				const startArguments: SkriptTypeState[] = [];
				const cutArguments: SkriptTypeState[] = [];

				//'cut' arguments out. for example get the last two %'s in 'send % to % parsed as %' when splitting at 'parsed as %'
				let argumentPos = 0;
				let argumentIndex = 0;
				while (true) {
					argumentPos = fullPattern.pattern.indexOf('%', argumentPos);
					//we also have to check if argumentIndex >= currentPatternArguments.length, because in some exceptions %'es don't always mean types
					if (argumentPos == -1 || argumentIndex >= patternArguments.length) break;
					if (argumentPos < subPatternStart)
						startArguments.push(patternArguments[argumentIndex++]);

					else if (argumentPos < subPatternEnd)
						cutArguments.push(patternArguments[argumentIndex++]);

					else break;
					//increase with 1, so the second time we'll be starting the search at argumentpos + 1
					argumentPos++;
				}
				const endArguments: SkriptTypeState[] = patternArguments.slice(argumentIndex);

				const isFullPattern = subPatternStart == 0 && subPatternEnd == fullPattern.pattern.length;

				const subPatternCall = new SkriptPatternCall(fullPattern.pattern.substring(subPatternStart, subPatternEnd), isFullPattern ? mainPatternType : PatternType.effect, cutArguments);
				//the pattern can't be just '%', because that would cause an infinite loop
				if (subPatternCall.pattern != '%') {
					foundPattern = this.getPatternData(subPatternCall, patternProcessor);
					if (foundPattern) {
						const registerMatch = () => {
							if (foundPattern)//for debugger
								context.addPatternMatch(foundPattern, fullPattern.getLinePos(subPatternStart), fullPattern.getLinePos(subPatternEnd));
						}
						if (isFullPattern) {
							//this is the deepest nested segmentatePattern call;
							//it has replaced everything matchable with % and will return succesfully.
							// for example:
							// send % to % parsed as player <-- match for 'player'
							// send % to % parsed as % <-- match for '% parsed as %'
							// send % to % <-- match for 'send % to %' isFullPattern = true

							// full pattern should color 'send ' and ' to '
							// layer above should color ' parsed as '
							// layer above should color 'player'
							this.tokenizeMatch(context, fullPattern, foundPattern)
							registerMatch();
							return foundPattern;
						}

						const replacedPattern = fullPattern.clone();
						replacedPattern.replaceInPattern(subPatternStart, subPatternEnd);
						//structuredClone() { ...fullPattern };// fullPattern.pattern.substring(0, start) + '%' + fullPattern.pattern.substring(end);
						//replacedPattern.

						//the amount of charachters that pattern parts on the right will shift to the left
						//const shiftToLeft = (end - start) - '%'.length;

						//cut the right off the pattern arguments
						//copy by value, just for safety
						const newPatternArguments: SkriptTypeState[] = [...startArguments];

						if (foundPattern.returnType) {
							newPatternArguments.push(foundPattern.returnType);
						}
						else {
							const unknownData = this.getTypeData("unknown");
							if (unknownData) {
								newPatternArguments.push(new SkriptTypeState(unknownData));
							}
						}
						newPatternArguments.push(...endArguments);


						// it's a possibility that this partial match is not the match we're looking for.
						// for example, "player's tool" will match "tool [of %livingentitities%] first, and convert it to "player's %".
						// THEN "player" is matched, which makes the whole pattern "%'s %".
						// to prevent this, let's check both possibilities, with the first possibility being the replaced pattern.
						const replacedMatch = this.segmentatePattern(context, mainPatternType, replacedPattern, newPatternArguments);
						if (replacedMatch) {
							//color the submatch (see explanation below isFullPattern condition)
							this.tokenizeMatch(context, fullPattern, foundPattern, subPatternStart, subPatternEnd);
							registerMatch();
							return replacedMatch;
						}
					}
				}
			}
		}
		//no pattern found at all, all possibilities checked
		return undefined;
	}

	//detect patterns like a [b | c]
	//return value: a type. basically, it will convert each subpattern into a result type (a %)
	detectPatternsRecursively(context: SkriptContext, mainPatternType: PatternType = PatternType.effect, isTopNode = true, currentNode: SkriptNestHierarchy = context.createHierarchy(true)): { detectedPattern: PatternData | undefined, possibleResultTypes: TypeData[] } {
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

		const results: TypeData[] = [];
		const childResultList: TypeData[][] = new Array(currentNode.children.length);

		//first: process all child nodes
		for (let i = 0; i < currentNode.children.length; i++) {
			//for (const currentChild of currentNode.children) {
			const nodeToClone = currentNode.children[i];
			//make the hierarchy relative to the node
			const offsetNode = nodeToClone.cloneWithOffset(-nodeToClone.start);

			const childResults = this.detectPatternsRecursively(context.push(nodeToClone.start, nodeToClone.end - nodeToClone.start), PatternType.effect, false, offsetNode);
			childResultList[i] = childResults.possibleResultTypes;
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
					if (child.character == '(') {
						if (childResultList[i].length == 0) continue;
					}
					else if (child.character == '{') {
						//variable
						this.addVariableReference(context.getLocation(child.start, child.end - child.start), context.currentString.substring(child.start, child.end));
						//context.addToken(variable.isParameter ? TokenTypes.parameter : TokenTypes.variable, child.start, child.end - child.start);
						const objectData = this.getTypeData("unknown");
						if (objectData) {
							mergedPatternArguments.set(child.start - 1, new SkriptTypeState(objectData));
						}
					}
					else if (child.character == '"') {
						const stringData = this.getTypeData("string");
						if (stringData)
							mergedPatternArguments.set(child.start, new SkriptTypeState(stringData));
					}
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

			//pass pattern by reference
			foundPattern = this.segmentatePattern(context, mainPatternType, pattern, currentPatternArguments);


			if (isTopNode && !foundPattern) {
				context.addDiagnostic(currentNode.start, currentNode.end - currentNode.start, "can't understand this line (pattern detection is a work in progress. please report on discord)", DiagnosticSeverity.Hint, "IntelliSkript->Pattern");
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
		return { possibleResultTypes: results, detectedPattern: foundPattern };
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
	createSection(context: SkriptContext): SkriptSection {
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
				section.detectPatternsRecursively(context.push(pattern.length));
				return section;
			}
		}
		if (context.currentString == 'else') {
			context.addToken(TokenTypes.keyword, 0, 'else'.length);
		}
		else {
			section.detectPatternsRecursively(context);
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

import { SkriptLoopSection } from '../SkriptLoopSection';
import { SkriptPropertySection } from '../reflect/SkriptPropertySection';
import { PatternMatch } from '../../../pattern/match/PatternMatch';

export class SkriptConditionSection extends SkriptSection {
	constructor(parent: SkriptSection, context: SkriptContext) {
		super(parent, context);
	}

}