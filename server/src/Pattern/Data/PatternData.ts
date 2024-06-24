import type { integer, Location } from 'vscode-languageserver/node';
import { SkriptTypeState } from "../../skript/storage/SkriptTypeState";
import type { SkriptPatternContainerSection } from '../../skript/section/reflect/SkriptPatternContainerSection';

export class PatternData {
	definitionLocation: Location;
	section?: SkriptPatternContainerSection;
	skriptPatternString: string;
	regexPatternString: string;
	/**this regexp only matches the whole string!*/
	patternRegExp: RegExp;
	expressionArguments: SkriptTypeState[];
	returnType: SkriptTypeState;
	argumentPositions: Location[] = [];
	patternType: PatternType = PatternType.effect;
	/**
	 * 
	 * @param skriptPatternString 
	 * @param regexPatternString 
	 * @param definitionLocation 
	 * @param patternType 
	 * @param section 
	 * @param expressionArguments 
	 * @param argumentPositions 
	 * @param resultType passed by reference!
	 */
	constructor(skriptPatternString: string, regexPatternString: string, definitionLocation: Location, patternType: PatternType, section?: SkriptPatternContainerSection, expressionArguments?: SkriptTypeState[], argumentPositions?: Location[], resultType?: SkriptTypeState) {
		this.skriptPatternString = skriptPatternString;
		this.regexPatternString = regexPatternString;
		this.patternRegExp = new RegExp(`^${regexPatternString}$`);
		this.definitionLocation = definitionLocation;
		this.section = section;
		this.expressionArguments = expressionArguments ?? [];
		this.argumentPositions = argumentPositions ?? [];
		this.patternType = patternType;
		this.returnType = resultType ?? new SkriptTypeState();
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
//import { SkriptPatternContainerSection } from '../skript/section/reflect/SkriptPatternContainerSection';
import { PatternType } from '../PatternType';
/**
 * caution! typedata is just a patterndata
 */
export type TypeData = PatternData;