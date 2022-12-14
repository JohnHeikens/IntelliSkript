import { SkriptContext } from '../SkriptContext';
import { TokenTypes } from '../../TokenTypes';
import{
	SkriptSection

} from "./SkriptSection";
import { PatternData, patternResultProcessor } from '../../PatternTree';
import { PatternType } from '../PatternTreeContainer';

const playerRegExpString = "(the )?player";
const playerRegExp = new RegExp(playerRegExpString);
export class SkriptCommand extends SkriptSection{
	playerPatternData: PatternData;
	//context.currentString should be 'command /test <string> :: string' for example
	constructor(context: SkriptContext, parent: SkriptSection){
		super(context, parent);
		this.playerPatternData = new PatternData("[the] player", playerRegExpString, context.getLocation(0, "command".length));
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
		context.addToken(TokenTypes.keyword, 0, context.currentString.length);
		return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		const regex = /^(aliases|executable by|usage|description|permission( message|)|cooldown|cooldown (message|bypass|storage)): (.*)/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);
		if (result == null){
			context.addDiagnostic(0, context.currentString.length, "make sure to put your code for the command in triggers");
		}
	}
	override getPatternData(pattern: string, shouldContinue: patternResultProcessor, type: PatternType): PatternData | undefined {
		if (type == PatternType.effect) {
			if(playerRegExp.test(pattern)){
				return this.playerPatternData;
			}
			//const s = this.eventPattern.section as SkriptEventSection;
			//for (let i = 0; i < s.eventValues.length; i++) {
			//	if (s.eventValues[i].patternRegExp.test(pattern)) {
			//		return s.eventValues[i];
			//	}
			//}
		}
		return super.getPatternData(pattern, shouldContinue, type);
	}
}