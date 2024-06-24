import { TokenTypes } from '../../../TokenTypes';
import { PatternType } from "../../../pattern/PatternType";
import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../skriptSection/SkriptSection';
import { SkriptPatternSection } from './SkriptPatternSection';
import { PatternTree } from '../../../pattern/PatternTree';
import assert = require('assert');
import { DiagnosticSeverity } from 'vscode-languageserver';
import { PatternData } from '../../../pattern/data/PatternData';
import { SkriptPatternCall } from '../../../pattern/SkriptPattern';
import { PatternResultProcessor } from '../../../pattern/patternResultProcessor';
import { SkriptTypeState } from '../../storage/SkriptTypeState';

const patternRegEx = /pattern(|s)/;
export class SkriptPatternContainerSection extends SkriptSection {
	argumentPatternTree: PatternTree = new PatternTree();
	returnType: SkriptTypeState = new SkriptTypeState();
	addPattern(context: SkriptContext): void {
		const pattern = PatternTree.parsePattern(context, this, PatternType.effect);
		if (pattern) {
			pattern.returnType = this.returnType;
			context.currentSkriptFile.addPattern(pattern);
			if (this.argumentPatternTree.compatiblePatterns.length == 0) {
				let counter = 0;
				for (const argumentType of pattern.expressionArguments) {
					const argumentPosition = pattern.argumentPositions[counter];
					//increase before converting to text, so the first argument will be 'expr-1'
					counter++;
					this.argumentPatternTree.addPattern(new PatternData("expr-" + counter, "expr-" + counter, argumentPosition, PatternType.effect, this, [], [], argumentType));
				}
			}
		}
	}

	createSection(context: SkriptContext): SkriptSection {
		//match whole string
		if (new RegExp(`^${patternRegEx.source}$`).test(context.currentString)) {
			context.addToken(TokenTypes.keyword);
			return new SkriptPatternSection(this, context);
		}
		else {
			//we don't recognise this pattern
			context.addDiagnostic(0, context.currentString.length, "unknown section", DiagnosticSeverity.Hint, "IntelliSkript->Section->Unknown");
			return new SkriptSection(this, context);
		}
	}
	processLine(context: SkriptContext): void {
		//match start of string and with : and space
		const result = new RegExp(`^${patternRegEx.source}: `).exec(context.currentString)
		if (result) {
			context.addToken(TokenTypes.keyword, 0, result[0].length);
			this.addPattern(context.push(result[0].length));
		}
	}
	override getPatternData(testPattern: SkriptPatternCall, shouldContinue: PatternResultProcessor): PatternData | undefined {
		return this.argumentPatternTree.getPatternData(testPattern, shouldContinue) ??
			super.getPatternData(testPattern, shouldContinue);
	}
}
