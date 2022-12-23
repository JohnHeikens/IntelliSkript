import { DiagnosticSeverity, Location } from 'vscode-languageserver/node';
import * as IntelliSkriptConstants from '../../IntelliSkriptConstants';
import { SkriptNestHierarchy } from '../../Nesting/SkriptNestHierarchy';
//import { PatternData } from "../../Pattern/PatternData";
import { PatternResultProcessor, stopAtFirstResultProcessor } from '../../Pattern/patternResultProcessor';
import { TokenTypes } from '../../TokenTypes';
import { PatternType } from "../../Pattern/PatternType";
import { SkriptContext } from '../SkriptContext';
import { SkriptPatternMatchHierarchy } from '../SkriptPatternMatchHierarchy';
import { SkriptVariable } from '../SkriptVariable';
import { SkriptEventListenerSection } from './SkriptEventListenerSection';
import { SkriptSectionGroup } from './SkriptSectionGroup';
//import { SkriptConditionSection } from './SkriptConditionSection';
import assert = require('assert');
import { PatternData } from '../../Pattern/PatternData';
import { SkriptPatternCall } from '../../Pattern/SkriptPattern';
import { SkriptTypeState } from '../SkriptTypeState';
//const variablePattern = /\{(.*)\}/g;
//IMPORT BELOW TO AVOID CIRCULAR DEPENDENCIES

export class SkriptSection extends SkriptSectionGroup {
	startLine: number;
	endLine: number;
	lineInfo: Map<number, SkriptPatternMatchHierarchy> = new Map<number, SkriptPatternMatchHierarchy>();

	constructor(context: SkriptContext, parent?: SkriptSectionGroup) {
		super(parent);
		this.startLine = context.currentLine;
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
			const newVariable = new SkriptVariable(referenceLocation, name, "unknown");
			this.definedVariables.push(newVariable);
			return newVariable;
		}
	}

	getTypeData(typeName: string): PatternData | undefined {
		return this.getPatternData(new SkriptPatternCall(typeName, PatternType.type), stopAtFirstResultProcessor);
	}

	private detectPatternsRecursively(context: SkriptContext, currentNode: SkriptNestHierarchy): SkriptPatternMatchHierarchy[] {

		const patternArguments: Map<number, SkriptTypeState> = new Map<number, SkriptTypeState>();
		const convert = ((start: number, input: string): string => {
			let m: RegExpMatchArray | null;
			const numberGlobalRegExp = new RegExp(IntelliSkriptConstants.NumberRegExp, "g");
			while ((m = numberGlobalRegExp.exec(input))) {
				assert(m.index != undefined);
				const numberData = this.getTypeData("number");
				if(numberData)
				{
					patternArguments.set(m.index, new SkriptTypeState(numberData));
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

		const results: SkriptPatternMatchHierarchy[] = [];
		const childResultList: SkriptPatternMatchHierarchy[][] = new Array(currentNode.children.length);


		for (let i = 0; i < currentNode.children.length; i++) {
			//for (const currentChild of currentNode.children) {
			const childResults = this.detectPatternsRecursively(context, currentNode.children[i]);
			childResultList[i] = childResults;
			results.push(...childResults);
		}
		//will also return true if currentNode.charachter is ''
		if ('%('.includes(currentNode.character)) {
			let pattern = '';
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
						const objectData = this.getTypeData("object");
						if(objectData)
						{
							patternArguments.set(child.start - 1, new SkriptTypeState(objectData));
						}
					}
					pattern += convert(currentPosition, context.currentString.substring(currentPosition, child.start - 1) + '%');
					currentPosition = child.end + 1;
				}
			}
			pattern += convert(currentPosition, context.currentString.substring(currentPosition, currentNode.end));

			//loop over sentence and try to replace as much as possible
			//add the change value to {_test} -> add the change value to % -> add % to %
			if (context.currentSkriptFile) {
				const patternProcessor: PatternResultProcessor = (pattern: PatternData) => {
					//this pattern includes a wildcard
					if (/(\(.*\)\?)?\.\+/.test(pattern.regexPatternString)) {
						return true;
					}
					else {
						return false;//found
					}
				};
				let result: PatternData | undefined = this.getPatternData(new SkriptPatternCall(pattern, PatternType.effect, Array.from(patternArguments.values())), patternProcessor);
				let match: RegExpMatchArray | null;
				const spaceRegex = / /g;
				while ((!result) && (match = spaceRegex.exec(pattern))) {
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
					result = context.currentSkriptFile.getPatternData(new SkriptPatternCall(pattern.substring(match.index + 1), PatternType.effect, cutArguments), patternProcessor);
				}
				if (result) {
					//match.index won't help
					const node = new SkriptPatternMatchHierarchy(currentNode.start, currentNode.end, result);
					results.push(node);
				}
				else if (currentNode.character != '(') {
					context.addDiagnostic(currentNode.start, currentNode.end - currentNode.start, "can't understand this line (pattern detection is a work in progress. please report on discord)", DiagnosticSeverity.Hint);
				}
			}
		}
		return results;
	}

	processLine(context: SkriptContext): void {

		let p: RegExpExecArray | null;
		//detect all variables in this line
		context.createHierarchy(true);
		if (!context.hasErrors) {
			assert(context.hierarchy != undefined);
			const results = this.detectPatternsRecursively(context, context.hierarchy);
			//start fitting all the results in a hierarchy
			if (results.length) {
				const h = new SkriptPatternMatchHierarchy(0, context.currentString.length);
				for (const result of results) {
					//this method assumes that nodes don't overlap
					const parentNode = h.getDeepestChildNodeAt(result.start);
					parentNode.children.push(result);
				}
				this.lineInfo.set(context.currentLine, h);
			}

		}

	}
	createSection(context: SkriptContext): SkriptSection {
		const checkPattern = /check \[(?!\()/g;
		let p: RegExpExecArray | null;
		let isIfStatement = false;
		while ((p = checkPattern.exec(context.currentString))) {
			const braceEndIndex = p.index + "check [".length;
			const node = context.hierarchy?.getChildNodeAt(braceEndIndex);//without the brace because we need to check the brace
			if (node && node.start == braceEndIndex) {
				context.addDiagnostic(
					p.index + "check [".length,
					node.end - node.start,
					`add braces around here to increase skript (re)load performance`, DiagnosticSeverity.Information, "IntelliSkript->Performance->Braces->Lambda");
				isIfStatement = true;
			}
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
		//if (isIfStatement) {
		//	return new SkriptConditionSection(context, this);
		//}
		return new SkriptSection(context, this);
	}
	getExactSectionAtLine(line: number): SkriptSection {
		const childSection = this.getChildSectionAtLine(line);
		return childSection == undefined ? this : childSection.getExactSectionAtLine(line);
	}


}

