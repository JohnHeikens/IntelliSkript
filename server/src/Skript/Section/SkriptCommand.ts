import { PatternData } from "../../Pattern/Data/PatternData";
import { PatternResultProcessor } from "../../Pattern/patternResultProcessor";
import { PatternType } from "../../Pattern/PatternType";
import { SkriptPatternCall } from '../../Pattern/SkriptPattern';
import { TokenTypes } from '../../TokenTypes';
import { SkriptContext } from '../SkriptContext';
import { SkriptTypeState } from '../SkriptTypeState';
import { SkriptSection } from "./SkriptSection/SkriptSection";

const playerRegExpString = "(the )?player";
const sectionRegExp = /(aliases|executable by|prefix|usage|description|permission(?: message|)|cooldown(?: (?:message|bypass|storage))?)/;
export class SkriptCommandSection extends SkriptSection {
	playerPatternData: PatternData;
	//context.currentString should be 'command /test <string> :: string' for example
	constructor(parent: SkriptSection, context: SkriptContext) {
		super(parent, context);
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
		const regex = new RegExp(`^${sectionRegExp.source}$`);// /^(aliases|executable by|prefix|usage|description|permission|cooldown|cooldown (message|bypass|storage)|trigger)$/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);

		if (result == null) {
			if (context.currentString == "trigger")
				context.addToken(TokenTypes.keyword, 0, context.currentString.length);
			else
				context.addDiagnostic(0, context.currentString.length, "cannot recognize this section. make sure to put your code for the command in triggers");
		}
		else
			context.addDiagnostic(0, context.currentString.length, "the " + context.currentString + " section has to be in one line. for example " + context.currentString + ": blahblahblah");

		return new SkriptSection(this, context);
	}
	processLine(context: SkriptContext): void {
		const regex = new RegExp(`^${sectionRegExp.source}`);// /^(aliases|executable by|prefix|usage|description|permission( message|)|cooldown|cooldown (message|bypass|storage)): (.*)/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);
		if (result == null)
			context.addDiagnostic(0, context.currentString.length, "make sure to put your code for the command in triggers");
		else
			context.addToken(TokenTypes.keyword, 0, result[0].length)
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
