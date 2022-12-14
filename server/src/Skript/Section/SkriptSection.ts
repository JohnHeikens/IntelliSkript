import {
	SkriptContext
} from '../SkriptContext';
import { SkriptVariable } from '../SkriptVariable';
import { SkriptSectionGroup } from './SkriptSectionGroup';
import { Location, DiagnosticSeverity, MarkupContent } from 'vscode-languageserver/node';
//const variablePattern = /\{(.*)\}/g;
//IMPORT BELOW TO AVOID CIRCULAR DEPENDENCIES

export class SkriptSection extends SkriptSectionGroup {

	startLine: number;
	endLine: number;
	lineInfo: Map<number, SkriptPatternMatchHierarchy> = new Map<number, SkriptPatternMatchHierarchy>();

	constructor(context: SkriptContext, parent?: SkriptSectionGroup) {
		super(parent);
		this.startLine = context.currentDocument.positionAt(context.currentPosition).line;
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

	addVariableReference(referenceLocation: Location, name: string): void {
		const existingVariable = this.getVariableByName(name);
		if (!existingVariable) {
			this.definedVariables.push(new SkriptVariable(referenceLocation, name, "unknown"));
		}
	}

	private detectPatternsRecursively(context: SkriptContext, currentNode: SkriptNestHierarchy): SkriptPatternMatchHierarchy[] {

		function convert(input: string): string {
			let result = input.replace(new RegExp(IntelliSkriptConstants.NumberRegExp, "g"), '%');
			result = result.replace(new RegExp(IntelliSkriptConstants.BooleanRegExp, "g"), '%');
			return result;
		}

		const results: SkriptPatternMatchHierarchy[] = [];
		const childResultList: SkriptPatternMatchHierarchy[][] = new Array(currentNode.children.length);

		if (currentNode.character == '{') {
			this.addVariableReference(Location.create(context.currentDocument.uri,
				{
					start: context.currentDocument.positionAt(context.currentPosition + currentNode.start),
					end: context.currentDocument.positionAt(context.currentPosition + currentNode.end)
				}), context.currentString.substring(currentNode.start, currentNode.end));
		}

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
				//for (const currentChild of currentNode.children) {
				if ('"{('.includes(currentNode.children[i].character)) {//string or variable
					if (currentNode.children[i].character == '(') {
						if (childResultList[i].length == 0) continue;
					}
					pattern += convert(context.currentString.substring(currentPosition, currentNode.children[i].start - 1) + '%');
					currentPosition = currentNode.children[i].end + 1;
				}
			}
			pattern += convert(context.currentString.substring(currentPosition, currentNode.end));

			//loop over sentence and try to replace as much as possible
			//add the change value to {_test} -> add the change value to % -> add % to %
			if (context.currentSkriptFile) {
				const patternProcessor: patternResultProcessor = (pattern: PatternData) => {
					if (pattern.skriptPatternString.includes("[event-]")) {
						//check if this is a custom event
						let currentCheckSection = this as SkriptSection;
						for (; ;) {
							if (currentCheckSection instanceof SkriptEventListenerSection) {
								//if(currentCheckSection.eventPattern.section
								return false;//correct
							}
							if (currentCheckSection.parent && currentCheckSection.parent instanceof SkriptSection) {
								currentCheckSection = currentCheckSection.parent;
							}
							else {
								return true;
							}
						}

						//return true;//this wildcard pattern should be ignored for now
					}
					else {
						return false;//found
					}
				};
				let result: PatternData | undefined = this.getPatternData(pattern, patternProcessor, PatternType.effect);
				let match;
				const spaceRegex = / /g;
				while ((!result) && (match = spaceRegex.exec(pattern))) {
					result = context.currentSkriptFile.getPatternData(pattern.substring(match.index + 1), patternProcessor, PatternType.effect);
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
		if (isIfStatement) {
			return new SkriptConditionSection(context, this);
		}
		return new SkriptSection(context, this);
	}
	getExactSectionAtLine(line: number): SkriptSection {
		const childSection = this.getChildSectionAtLine(line);
		return childSection == undefined ? this : childSection.getExactSectionAtLine(line);
	}


}
import { SkriptConditionSection } from './Reflect/SkriptConditionSection'; import { SkriptNestHierarchy } from '../../Nesting/SkriptNestHierarchy';
import { PatternData, patternResultProcessor } from '../../PatternTree';
import { SkriptEventListenerSection } from './SkriptEventListenerSection';
import { SkriptPatternMatchHierarchy } from '../SkriptPatternMatchHierarchy';
import assert = require('assert');
import { IntelliSkriptConstants } from '../../IntelliSkriptConstants';
import { mainModule } from 'process';
import { TokenTypes } from '../../TokenTypes';
import { PatternType } from '../PatternTreeContainer';

