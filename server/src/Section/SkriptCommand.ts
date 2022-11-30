import { SkriptContext } from '../SkriptContext';
import{
	SkriptSection

} from "./SkriptSection";
export class SkriptCommand extends SkriptSection{
	//context.currentString should be 'command /test <string> :: string' for example
	constructor(context: SkriptContext, parent: SkriptSection){
		super(context, parent);
		const regex = /command (\/|)(((?! ).){1,})( ((?! ).){1,}){0,}/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);
		if (result == null){
			context.addDiagnostic(0, context.currentString.length, "cannot recognize this command");
		}
	}
	createSection(context: SkriptContext): SkriptSection {
		const regex = /^(aliases|executable by|usage|description|permission|cooldown|cooldown (message|bypass|storage)|trigger)$/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);

		if (result == null){
			context.addDiagnostic(0, context.currentString.length, "cannot recognize this section. make sure to put your code for the command in triggers");
		}
		return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		const regex = /^(aliases|executable by|usage|description|permission( message|)|cooldown|cooldown (message|bypass|storage)): (.*)/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);
		if (result == null){
			context.addDiagnostic(0, context.currentString.length, "make sure to put your code for the command in triggers");
		}
	}
}