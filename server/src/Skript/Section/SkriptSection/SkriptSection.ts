import { DiagnosticSeverity, Location, Position } from 'vscode-languageserver/node';
import * as IntelliSkriptConstants from '../../../IntelliSkriptConstants';
import { SkriptNestHierarchy } from '../../../Nesting/SkriptNestHierarchy';
//import { PatternData } from "../../Pattern/PatternData";
import { PatternResultProcessor, stopAtFirstResultProcessor } from '../../../Pattern/patternResultProcessor';
import { TokenTypes } from '../../../TokenTypes';
import { PatternType } from "../../../Pattern/PatternType";
import { SkriptContext } from '../../SkriptContext';
import { SkriptPatternMatchHierarchy } from '../../SkriptPatternMatchHierarchy';
import { SkriptVariable } from '../../SkriptVariable';
import { SkriptSectionGroup } from '../SkriptSectionGroup';
//import { SkriptConditionSection } from './SkriptConditionSection';
import assert = require('assert');
import { PatternData, TypeData } from '../../../Pattern/Data/PatternData';
import { SkriptPatternCall } from '../../../Pattern/SkriptPattern';
import { SkriptTypeState } from '../../SkriptTypeState';
import { TokenModifiers } from '../../../TokenModifiers';
//import { createBasicSection } from './CreateBasicSection';
//const variablePattern = /\{(.*)\}/g;
//IMPORT BELOW TO AVOID CIRCULAR DEPENDENCIES

//declare class SkriptConditionSection extends SkriptSection {
//	constructor(context: SkriptContext, parent?: SkriptSectionGroup);
//}
//declare function createBasicSection(context: SkriptContext, parentSection: SkriptSection): SkriptSection;
export class SkriptSection extends SkriptSectionGroup {
	startLine: number;
	endLine: number;
	override children: SkriptSection[] = [];

	constructor(context?: SkriptContext, parent?: SkriptSectionGroup) {
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
		let modifier;
		if (data) {
			modifier = TokenModifiers.abstract;
			context.addPatternMatch(data, start, end);
		}
		else {
			modifier = TokenModifiers.deprecated;
			context.addDiagnostic(start, end - start, "cannot recognize type", DiagnosticSeverity.Error);
		}
		context.addToken(TokenTypes.type, start, end - start, 1, modifier);
		return data;
	}

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
			context.addToken(TokenTypes.type, currentPosition, parts[i].length);
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

			if (typePattern) {
				result.possibleTypes.push(typePattern);
				context.addPatternMatch(typePattern, currentPosition, currentPosition + parts[i].length);
			}
			else {
				//error 'type not recognized' has been added by the getPatternData function already
				return undefined;
			}
		}
		return result;
	}

	//detect patterns like a [b | c]
	//return value: a type. basically, it will convert each subpattern into a result type (a %)
	detectPatternsRecursively(context: SkriptContext, currentNode: SkriptNestHierarchy): TypeData[] {

		const patternArguments: Map<number, SkriptTypeState> = new Map<number, SkriptTypeState>();

		//number types are defined too and just return 'number'. the only thing we're doing here is coloring the numbers differently.
		//detect numbers (like '2') and convert them to types (%)
		const convertLiteralsToSymbols = ((start: number, input: string): string => {
			let m: RegExpMatchArray | null;
			const numberGlobalRegExp = new RegExp(IntelliSkriptConstants.NumberRegExp, "g");
			while ((m = numberGlobalRegExp.exec(input))) {
				assert(m.index != undefined);
				const numberData = this.getTypeData("number");
				if (numberData) {
					//patternArguments.set(m.index, new SkriptTypeState(numberData));
					context.addToken(TokenTypes.number, start + m.index, m[0].length);
				}
			}
			//const booleanGlobalRegExp = new RegExp(IntelliSkriptConstants.BooleanRegExp, "g");
			//while ((m = booleanGlobalRegExp.exec(input))) {
			//	patternArguments.set(m.index, new SkriptTypeState(this.getTypeData("boolean")));
			//	context.addToken(TokenTypes.enum, start + m.index, m[0].length);
			//}

			//const result = input.replace(numberGlobalRegExp, '%');
			//result = result.replace(booleanGlobalRegExp, '%');
			return input;
		});

		const results: TypeData[] = [];
		const childResultList: TypeData[][] = new Array(currentNode.children.length);

		//first: process all child nodes
		for (let i = 0; i < currentNode.children.length; i++) {
			//for (const currentChild of currentNode.children) {
			const childResults = this.detectPatternsRecursively(context, currentNode.children[i]);
			childResultList[i] = childResults;
			//results.push(...childResults);
		}
		//then process main node
		//will also return true if currentNode.charachter is ''
		if ('%('.includes(currentNode.character)) {
			let mergedPattern = '';
			let currentPosition = currentNode.start;



			//pattern = pattern.replace(/\{.*\}/g, '%');

			for (let i = 0; i < currentNode.children.length; i++) {
				const child = currentNode.children[i];
				//for (const currentChild of currentNode.children) {
				if ('"{('.includes(child.character)) {//string or variable
					if (child.character == '(') {
						if (childResultList[i].length == 0) continue;
					}
					else if (child.character == '{') {
						//variable
						//const variable = this.
						const variable = this.addVariableReference(Location.create(context.currentDocument.uri,
							{
								start: context.currentDocument.positionAt(context.currentPosition + child.start),
								end: context.currentDocument.positionAt(context.currentPosition + child.end)
							}), context.currentString.substring(child.start, child.end));
						context.addToken(variable.isParameter ? TokenTypes.parameter : TokenTypes.variable, child.start, child.end - child.start);
						const objectData = this.getTypeData("unknown");
						if (objectData) {
							patternArguments.set(child.start - 1, new SkriptTypeState(objectData));
						}
					}
					else if (child.character == '"') {
						const stringData = this.getTypeData("string");
						if (stringData)
							patternArguments.set(child.start, new SkriptTypeState(stringData));
					}
					mergedPattern += convertLiteralsToSymbols(currentPosition, context.currentString.substring(currentPosition, child.start - 1) + '%');
					currentPosition = child.end + 1;
				}
			}
			mergedPattern += convertLiteralsToSymbols(currentPosition, context.currentString.substring(currentPosition, currentNode.end));
			//now the merged pattern is complete.

			//sometimes it's just a variable
			if (mergedPattern != "%") {

				//loop over sentence and try to replace as much as possible
				//add the change value to {_test} -> add the change value to % -> add % to %
				assert(context.currentSkriptFile);
				const patternProcessor: PatternResultProcessor = (pattern: PatternData) => {
					//this pattern includes a wildcard
					if (/(\(.*\)\?)?\.\+/.test(pattern.regexPatternString)) {
						return true;
					}
					else {
						return false;//found
					}
				};
				//check if the merged pattern is a valid pattern
				let foundPattern: PatternData | undefined = this.getPatternData(new SkriptPatternCall(mergedPattern, PatternType.effect, Array.from(patternArguments.values())), patternProcessor);
				let match: RegExpMatchArray | null;
				const spaceRegex = / /g;
				while ((!foundPattern) && (match = spaceRegex.exec(mergedPattern))) {
					const cutArguments: SkriptTypeState[] = [];
					assert(match.index != undefined);
					//'cut' arguments out
					patternArguments.forEach((argument, key) => {
						assert(match != null);
						assert(match.index != undefined);
						if (key >= match.index) {
							cutArguments.push(argument);
						}
					});
					foundPattern = context.currentSkriptFile.getPatternData(new SkriptPatternCall(mergedPattern.substring(match.index + 1), PatternType.effect, cutArguments), patternProcessor);
				}
				if (foundPattern) {
					//match.index won't help
					const node = new SkriptPatternMatchHierarchy(currentNode.start, currentNode.end, foundPattern);
					context.addPatternMatch(foundPattern, currentNode.start, currentNode.end);
					//todo: add result type?
					//results.push(foundPattern.);
					//results.push(node);
				}
				else if (currentNode.character != '(') {
					context.addDiagnostic(currentNode.start, currentNode.end - currentNode.start, "can't understand this line (pattern detection is a work in progress. please report on discord)", DiagnosticSeverity.Hint);
				}
			}
		}
		else if (currentNode.character == '"') {
			let currentPosition = currentNode.start - 1;

			for (let i = 0; i < currentNode.children.length; i++) {
				{
					const child = currentNode.children[i];
					context.addToken(TokenTypes.string, currentPosition, child.start - currentPosition);
					currentPosition = child.end;
				}
			}
			context.addToken(TokenTypes.string, currentPosition, currentNode.end + 1 - currentPosition);
		}
		return results;
	}

	processLine(context: SkriptContext): void {

		let p: RegExpExecArray | null;
		//detect all variables in this line and create a hierarchy of for example opening and closing braces:
		// hi[er(ar|ch)]y
		context.createHierarchy(true);
		if (!context.hasErrors) {
			assert(context.hierarchy != undefined);
			this.detectPatternsRecursively(context, context.hierarchy);
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
			return new SkriptLoopSection(context, this);
		}
		if (context.currentString.startsWith("if ")) {
			isIfStatement = true;
			context.addToken(TokenTypes.keyword, 0, "if".length);
		}
		else if (context.currentString.startsWith("else if")) {
			isIfStatement = true;
			context.addToken(TokenTypes.keyword, 0, "else if".length);
		}
		else if (context.currentString == "else") {
			context.addToken(TokenTypes.keyword, 0, "else".length);
		}
		if (isIfStatement) {
			return new SkriptConditionSection(context, this);
		}
		return new SkriptSection(context, this);

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

export class SkriptConditionSection extends SkriptSection {
	constructor(context: SkriptContext, parent?: SkriptSectionGroup) {
		super(context, parent);
		const startPosition = context.currentString.startsWith("if ") ? "if ".length : 0;
		const conditionContext = context.push(startPosition);
		conditionContext.createHierarchy(true);
		if (conditionContext.hierarchy) {
			const result = this.detectPatternsRecursively(conditionContext, conditionContext.hierarchy);
		}
	}

}