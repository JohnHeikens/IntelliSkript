import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection';
import { SkriptType } from '../../SkriptType';
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
	returnType = new SkriptType();
	createSection(context: SkriptContext): SkriptSection {
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
				context.addDiagnostic(0, context.currentString.length, "cannot recognize this section");
			}
		}
		return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		if (context.currentString.startsWith("return type: ")) {
			this.returnType = new SkriptType(context.currentString.substring("return type: ".length).toLowerCase());
		}
		//TODO throw error
	}
}