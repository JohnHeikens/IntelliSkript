import { PatternData } from "../../pattern/data/PatternData";
import { PatternTreeContainer } from '../../pattern/PatternTreeContainer';
import { PatternType } from "../../pattern/PatternType";
import { SkriptPatternCall } from "../../pattern/SkriptPattern";
import { TokenTypes } from '../../TokenTypes';
import { SkriptTypeState } from '../storage/type/SkriptTypeState';
import { SkriptContext } from '../validation/SkriptContext';
import { SkriptSection } from "./skriptSection/SkriptSection";

const sectionRegExp = /(aliases|executable by|prefix|usage|description|permission(?: message|)|cooldown(?: (?:message|bypass|storage))?)/;
export class SkriptCommandSection extends SkriptSection {
	patternContainer: PatternTreeContainer;
	name = "";
	//context.currentString should be 'command /test <string> :: string' for example
	constructor(parent: SkriptSection, context: SkriptContext) {
		super(parent, context);
		this.patternContainer = new PatternTreeContainer(parent.getPatternTree());

		//get the "player" type, not the entity literal
		const playerType = super.getTypeData("player");
		const commandSenderData = this.getPatternData(new SkriptPatternCall("command sender", PatternType.expression))?.fullMatch.matchedPattern;
		if (playerType && commandSenderData)
			this.patternContainer.addPattern(new PatternData("[the] player", "(the )?player", commandSenderData.definitionLocation, PatternType.expression, undefined, [], [], new SkriptTypeState(playerType)));


		const validCommandRegex = /^command \/?([a-zA-Z0-9_]+)( ((?! ).){1,})*$/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = validCommandRegex.exec(context.currentString);
		//extract arguments and their types from the current string

		const typeRegex = /\<(.+?)\>/g;
		let previousIndex = "command ".length;
		let m;
		let argumentIndex = 1;
		while (m = typeRegex.exec(context.currentString)) {
			let typeStart = m.index + 1;
			let typeEnd = typeStart + m[1].length;
			context.addToken(TokenTypes.regexp, previousIndex, typeStart - previousIndex);
			//parse types
			const parsedTypes = this.parseTypes(context, typeStart, m[1].length);
			this.patternContainer.addPattern(new PatternData("arg[ument]( |-)" + argumentIndex, "arg(ument)?( |-)" + argumentIndex, context.getLocation(typeStart, m[1].length), PatternType.expression, undefined, [], [], parsedTypes))
			previousIndex = typeEnd;
			argumentIndex++;
		}
		context.addToken(TokenTypes.regexp, previousIndex);

		if (result == null) {
			context.addDiagnostic(0, context.currentString.length, "cannot recognize this command");
		}
		else {
			this.name = result[1];
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
