import { PatternData } from "../../pattern/data/PatternData";
import { PatternTreeContainer } from '../../pattern/PatternTreeContainer';
import { PatternType } from "../../pattern/PatternType";
import { TokenTypes } from '../../TokenTypes';
import { SkriptTypeState } from '../storage/type/SkriptTypeState';
import { SkriptContext } from '../validation/SkriptContext';
import { SkriptSection } from "./skriptSection/SkriptSection";

const playerRegExpString = "(the )?player";
const sectionRegExp = /(aliases|executable by|prefix|usage|description|permission(?: message|)|cooldown(?: (?:message|bypass|storage))?)/;
export class SkriptCommandSection extends SkriptSection {
	playerPatternData: PatternData;
	//context.currentString should be 'command /test <string> :: string' for example
	constructor(parent: SkriptSection, context: SkriptContext) {
		super(parent, context);
		this.patternContainer = new PatternTreeContainer(parent.getPatternTree());
		//get the "player" type, not the entity literal
		const playerType = super.getTypeData("player");
		const resultType = playerType ? new SkriptTypeState(playerType) : new SkriptTypeState();
		this.playerPatternData = new PatternData("[the] player", playerRegExpString, context.getLocation(0, "command".length), PatternType.expression, undefined, [], [], resultType);
		const regex = /command (\/|)(((?! ).){1,})( ((?! ).){1,}){0,}/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);
		if (result == null) {
			context.addDiagnostic(0, context.currentString.length, "cannot recognize this command");
		}
	}
	createSection(context: SkriptContext): SkriptSection | undefined {
		const regex = new RegExp(`^${sectionRegExp.source}$`);// /^(aliases|executable by|prefix|usage|description|permission|cooldown|cooldown (message|bypass|storage)|trigger)$/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);

		if (result == null) {
			if (context.currentString == "trigger")
				context.addToken(TokenTypes.keyword, 0, context.currentString.length);
			else {
				context.addDiagnostic(0, context.currentString.length, "cannot recognize this section. make sure to put your code for the command in triggers");
				return undefined;
			}
		}
		else
			context.addDiagnostic(0, context.currentString.length, "the " + context.currentString + " section has to be in one line. for example " + context.currentString + ": blahblahblah");

		return new SkriptSection(this, context);
	}
	processLine(context: SkriptContext): void {
		const regex = new RegExp(`^${sectionRegExp.source}`);// /^(aliases|executable by|prefix|usage|description|permission( message|)|cooldown|cooldown (message|bypass|storage)): (.*)/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);
		if (result == null) {
			context.addDiagnostic(0, context.currentString.length, "make sure to put your code for the command in triggers");
		}
		else
			context.addToken(TokenTypes.keyword, 0, result[0].length)
	}
}
