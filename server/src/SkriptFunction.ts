import { SkriptContext } from './SkriptContext';
import{
	SkriptSection

} from "./SkriptSection";
export class SkriptFunction extends SkriptSection{
	name: string;
	//context.currentString should be 'function example(a: string, b: number) :: string' for example
	constructor(context: SkriptContext, parent: SkriptSection){
		super(parent);
		const regex = /function ([a-zA-Z1-9_]{1,})\(((.*)(,|and|)){1,}\)(| :: (.*))/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);
		if (result == null){
			context.addDiagnostic(context.currentPosition, context.currentString.length, "cannot recognize function");
			this.name = "";
		}
		else{
			this.name = result[0];
		}


	}
}