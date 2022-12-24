import { TokenTypes } from '../../../TokenTypes';
import { SkriptContext } from '../../SkriptContext';
import { SkriptTypeState } from "../../SkriptTypeState";
import { SkriptSection } from '../SkriptSection';
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
	returnType = new SkriptTypeState();
	createSection(context: SkriptContext): SkriptSection {
		let recognized = true;
		if (context.currentString == "get") {
			this.hasGet = true;
		}
		else if (context.currentString == "set") {
			this.hasSet = true;
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
			const regex = /^(pattern(|s))$/;
			const result = regex.exec(context.currentString);


			if (result == null) {
				recognized = false;
				context.addDiagnostic(0, context.currentString.length, "cannot recognize this section");
			}
		}
		if (recognized) {
			context.addToken(TokenTypes.keyword);
		}
		return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		if (context.currentString.startsWith("return type: ")) {
			const parsedType = this.parseType(context, "return type: ".length);
			if (parsedType) {
				this.returnType = new SkriptTypeState(parsedType);
			}
			else {
				const obj = this.getTypeData("object");
				if (obj) {
					this.returnType = new SkriptTypeState(obj);
				}
			}
			//this.returnType = new skriptt(context.currentString.substring("return type: ".length).toLowerCase());
		}
		//TODO throw error
	}
}