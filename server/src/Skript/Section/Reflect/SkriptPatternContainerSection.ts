import { TokenTypes } from '../../../TokenTypes';
import { PatternType } from "../../../pattern/PatternType";
import { SkriptContext } from '../../validation/SkriptContext';
import { SkriptSection } from '../skriptSection/SkriptSection';
import { SkriptPatternSection } from './SkriptPatternSection';
import { PatternTree } from '../../../pattern/PatternTree';
import assert = require('assert');
import { DiagnosticSeverity } from 'vscode-languageserver';
import { PatternData } from '../../../pattern/data/PatternData';
import { SkriptPatternCall } from '../../../pattern/SkriptPattern';
import { PatternResultProcessor } from '../../../pattern/patternResultProcessor';
import { SkriptTypeState } from '../../storage/type/SkriptTypeState';
import { MatchArray } from '../../../pattern/match/matchArray';

const patternRegEx = /pattern(|s)/;
export class SkriptPatternContainerSection extends SkriptSection {
	static patternType = PatternType.expression;
	argumentPatternTree: PatternTree = new PatternTree();
	returnType: SkriptTypeState = new SkriptTypeState();
	patterns: PatternData[] = [];
	addPattern(context: SkriptContext): void {
		const pattern = PatternTree.parsePattern(context, this, (<typeof SkriptPatternContainerSection>this.constructor).patternType);
		if (pattern) {
			this.patterns.push(pattern);
			pattern.returnType = this.returnType;
			if (this.argumentPatternTree.compatiblePatterns.length == 0) {
				let counter = 0;
				for (const argumentType of pattern.expressionArguments) {
					const argumentPosition = pattern.argumentPositions[counter];
					//increase before converting to text, so the first argument will be 'expr-1'
					counter++;
					this.argumentPatternTree.addPattern(new PatternData("expr-" + counter, "expr-" + counter, argumentPosition, PatternType.expression, this, [], [], argumentType));
				}
			}
		}
	}

	createSection(context: SkriptContext): SkriptSection | undefined {
		//match whole string
		if (new RegExp(`^${patternRegEx.source}$`).test(context.currentString)) {
			context.addToken(TokenTypes.keyword);
			return new SkriptPatternSection(this, context);
		}
		else {
			//we don't recognise this pattern
			//context.addDiagnostic(0, context.currentString.length, "unknown section", DiagnosticSeverity.Hint, "IntelliSkript->Section->Unknown");
			return undefined;
		}
	}
	processLine(context: SkriptContext): void {
		//match start of string and with : and space
		const result = new RegExp(`^${patternRegEx.source}: `).exec(context.currentString)
		if (result) {
			context.addToken(TokenTypes.keyword, 0, result[0].length);
			this.addPattern(context.push(result[0].length));
		}
		else {
			context.addDiagnostic(0, context.currentString.length, 'expected patterns here', DiagnosticSeverity.Error);
		}
	}
	override getPatternData(testPattern: SkriptPatternCall): PatternData | undefined {
		//const result = this.argumentPatternTree.getPatternData(testPattern);
		//return result ?? 
		return super.getPatternData(testPattern);
	}
	override finish(context: SkriptContext) {
		for (const pattern of this.patterns)
			context.currentSkriptFile.addPattern(pattern);

		super.finish(context);
	}
}
