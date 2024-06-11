import type { Location } from 'vscode-languageserver/node';
import type { SkriptTypeState } from "../../Skript/SkriptTypeState";
import type { SkriptPatternContainerSection } from '../../Skript/Section/Reflect/SkriptPatternContainerSection';

export class PatternData {
	definitionLocation: Location;
	section?: SkriptPatternContainerSection;
	skriptPatternString: string;
	regexPatternString: string;
	patternRegExp: RegExp;
	expressionArguments: SkriptTypeState[];
	type: PatternType = PatternType.effect;
	constructor(skriptPatternString: string, regexPatternString: string, definitionLocation: Location, patternExpressionArguments: SkriptTypeState[], type: PatternType, section?: SkriptPatternContainerSection) {
		this.skriptPatternString = skriptPatternString;
		this.regexPatternString = regexPatternString;
		this.patternRegExp = new RegExp(regexPatternString);
		this.definitionLocation = definitionLocation;
		this.section = section;
		this.expressionArguments = patternExpressionArguments;
		this.type = type;
		//check if the pattern is a wildcard
		//const h = createRegExpHierarchy(this.regexPatternString);
		//remove optional parts
		//let wildCardCheckString = '';
		//let currentPosition = 0;
		//for(let i = 0; i < h.children.length; i++)
		//{
		//	if(h.children[i].character == '('){
		//		wildCardCheckString += skriptPatternString.substring(currentPosition, h.children[i].start - 1);
		//		currentPosition = h.children[i].end + 1;
		//	}
		//}
	}
	equals(other: PatternData) {
		return this.definitionLocation == other.definitionLocation;
	}
}
//import { SkriptPatternContainerSection } from '../Skript/Section/Reflect/SkriptPatternContainerSection';
import { PatternType } from '../PatternType';
/**
 * caution! typedata is just a patterndata
 */
export type TypeData = PatternData;