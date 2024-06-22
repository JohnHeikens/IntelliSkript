import { TokenModifiers } from '../../../TokenModifiers';
import { TokenTypes } from '../../../TokenTypes';
import { SkriptContext } from '../../SkriptContext';
import { SkriptTypeState } from "../../SkriptTypeState";
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
	createSection(context: SkriptContext): SkriptSection {
		let recognized = true;
		let keywordEnd = context.currentString.length;
		if (context.currentString == "get") {
			this.hasGet = true;
		}
		else if (context.currentString.startsWith("set ")) {
			this.parseType(context, 'set '.length);
			this.hasSet = true;
			keywordEnd = 'set '.length;
		}
		else if (context.currentString == "add") {
			this.hasAdd = true;
		}
		else if (context.currentString == "remove") {
			this.hasRemove = true;
		}
		else if (context.currentString == "remove all") {
			this.hasRemoveAll = true;
		}
		else if (context.currentString == "delete") {
			this.hasDelete = true;
		}
		else if (context.currentString == "reset") {
			this.hasReset = true;
		}
		else {
			recognized = false;
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
	}
}