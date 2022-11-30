import { SkriptContext } from '../SkriptContext';
import{
	SkriptSection

} from "./SkriptSection";
export class SkriptEffect extends SkriptSection{
	createSection(context: SkriptContext): SkriptSection {
		const regex = /^(parse|trigger|pattern(|s))$/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);

		if (result == null){
			context.addDiagnostic(0, context.currentString.length, "cannot recognize this section. make sure to put your code for the effect in triggers");
		}
		return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		context.addDiagnostic(0, context.currentString.length, "make sure to put your code for the effect in triggers");
	}
}