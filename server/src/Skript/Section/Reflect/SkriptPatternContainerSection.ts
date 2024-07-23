import { DiagnosticSeverity } from 'vscode-languageserver';
import { PatternData } from '../../../pattern/data/PatternData';
import { PatternTree } from '../../../pattern/PatternTree';
import { PatternTreeContainer } from '../../../pattern/PatternTreeContainer';
import { PatternType } from "../../../pattern/PatternType";
import { TokenTypes } from '../../../TokenTypes';
import { SkriptTypeState } from '../../storage/type/SkriptTypeState';
import { SkriptContext } from '../../validation/SkriptContext';
import { SkriptSection } from '../skriptSection/SkriptSection';
import { SkriptSectionGroup } from '../SkriptSectionGroup';
import { SkriptPatternSection } from './SkriptPatternSection';


const patternRegEx = /pattern(|s)/;
export class SkriptPatternContainerSection extends SkriptSection {
	static patternType = PatternType.expression;
	patternContainer: PatternTreeContainer;
	returnType: SkriptTypeState = new SkriptTypeState();
	patterns: PatternData[] = [];
	/**
	 * used by expression and property section to parse the pattern and extract arguments
	 * @param context 
	 * @returns the parsed pattern. it's not added yet!
	 */
	parsePattern(context: SkriptContext): PatternData | undefined {
		const pattern = PatternTree.parsePattern(context, this, (<typeof SkriptPatternContainerSection>this.constructor).patternType);
		if (pattern) {
			pattern.returnType = this.returnType;
			if (this.patterns.length == 0) {
				let counter = 0;
				for (const argumentType of pattern.expressionArguments) {
					const argumentPosition = pattern.argumentPositions[counter];
					//increase before converting to text, so the first argument will be 'expr-1'
					counter++;
					this.patternContainer.addPattern(new PatternData("expr-" + counter, "expr-" + counter, argumentPosition, PatternType.expression, this, [], [], argumentType));
				}
			}
		}
		return pattern;
	}
	addPattern(context: SkriptContext): void {
		const pattern = this.parsePattern(context);
		if (pattern)
			this.patterns.push(pattern);
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
	override getPatternTree(): PatternTreeContainer | undefined {
		return this.patternContainer;
	}
	override finish(context: SkriptContext) {
		for (const pattern of this.patterns)
			context.currentSkriptFile.addPattern(pattern);

		super.finish(context);
	}
	constructor(parent: SkriptSectionGroup, context?: SkriptContext) {
		super(parent, context);
		this.patternContainer = new PatternTreeContainer(parent.getPatternTree());
	}
}
