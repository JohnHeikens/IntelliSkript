import { PatternTree } from '../../../pattern/PatternTree';
import { PatternType } from '../../../pattern/PatternType';
import { TokenTypes } from '../../../TokenTypes';
import { SkriptContext } from '../../validation/SkriptContext';
import { SkriptSection } from '../skriptSection/SkriptSection';
import { SkriptPatternContainerSection } from './SkriptPatternContainerSection';
export class SkriptExpressionSection extends SkriptPatternContainerSection {
	//set y to x
	hasGet = false;
	//set x to y
	hasSet = false;
	//add y to x
	hasAdd = false;
	//remove y from x
	hasRemove = false;
	//delete x
	hasDelete = false;
	//reset x
	hasReset = false;
	//delete x::*
	hasRemoveAll = false;
	createSection(context: SkriptContext): SkriptSection | undefined {
		let recognized = true;
		let keywordEnd = context.currentString.length;
		switch (context.currentString) {
			case "get": this.hasGet = true; break;
			case "set": this.hasSet = true; break;
			case "add": this.hasAdd = true; break;
			case "delete": this.hasDelete = true; break;
			case "reset": this.hasReset = true; break;
			case "remove": this.hasRemove = true; break;
			case "remove all": this.hasRemoveAll = true; break;
			//set %type%
			default: if (context.currentString.startsWith("set ")) {
				this.parseType(context, 'set '.length);
				this.hasSet = true;
				keywordEnd = 'set '.length;
			}
			else recognized = false;
		}

		if (recognized) {
			context.addToken(TokenTypes.keyword, 0, keywordEnd);
			return new SkriptSection(this, context);
		}
		else
			return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		if (context.currentString.startsWith("return type: ")) {
			context.addToken(TokenTypes.keyword, 0, "return type: ".length);
			let parsedType = this.parseType(context, "return type: ".length) ?? this.getTypeData("object");
			if (parsedType) {
				this.returnType.possibleTypes.push(parsedType);
			}
		}
		else super.processLine(context);

	}
	override addPattern(context: SkriptContext): void {
		const p = this.parsePattern(context);
		if (p) {
			this.patterns.push(p);
			//add delete, set, 
		}
	}
}