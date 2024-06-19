import { PatternData } from "../../Pattern/Data/PatternData";
import { PatternResultProcessor } from "../../Pattern/patternResultProcessor";
import { PatternType } from "../../Pattern/PatternType";
import { SkriptPatternCall } from '../../Pattern/SkriptPattern';
import { TokenTypes } from '../../TokenTypes';
import { SkriptContext } from '../SkriptContext';
import { SkriptTypeState } from '../SkriptTypeState';
import { SkriptSection } from "./SkriptSection/SkriptSection";

const playerRegExpString = "(the )?player";
export class SkriptCommandSection extends SkriptSection {
	playerPatternData: PatternData;
	//context.currentString should be 'command /test <string> :: string' for example
	constructor(context: SkriptContext, parent: SkriptSection) {
		super(context, parent);
		//get the "player" type, not the entity literal
		const playerType = super.getTypeData("player");
		const resultType = playerType ? new SkriptTypeState(playerType) : new SkriptTypeState();
		this.playerPatternData = new PatternData("[the] player", playerRegExpString, context.getLocation(0, "command".length), PatternType.effect, undefined, [], [], resultType);
		const regex = /command (\/|)(((?! ).){1,})( ((?! ).){1,}){0,}/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);
		if (result == null) {
			context.addDiagnostic(0, context.currentString.length, "cannot recognize this command");
		}
	}
	createSection(context: SkriptContext): SkriptSection {
		const regex = /^(aliases|executable by|prefix|usage|description|permission|cooldown|cooldown (message|bypass|storage)|trigger)$/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);

		if (result == null) {
			context.addDiagnostic(0, context.currentString.length, "cannot recognize this section. make sure to put your code for the command in triggers");
		}
		else if (context.currentString != "trigger") {
			context.addDiagnostic(0, context.currentString.length, "the " + context.currentString + " section has to be in one line. for example " + context.currentString + ": blahblahblah");
		}
		context.addToken(TokenTypes.keyword, 0, context.currentString.length);
		return super.createSection(context);
	}
	processLine(context: SkriptContext): void {
		const regex = /^(aliases|executable by|prefix|usage|description|permission( message|)|cooldown|cooldown (message|bypass|storage)): (.*)/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);
		if (result == null) {
			context.addDiagnostic(0, context.currentString.length, "make sure to put your code for the command in triggers");
		}
	}
	override getPatternData(testPattern: SkriptPatternCall, shouldContinue: PatternResultProcessor): PatternData | undefined {
		if (testPattern.type == PatternType.effect) {
			if (testPattern.compare(this.playerPatternData)) {
				return this.playerPatternData;
			}
		}
		return super.getPatternData(testPattern, shouldContinue);
	}
}
