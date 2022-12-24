import { SkriptType } from './SkriptType';
import { SkriptTypeSection } from './Section/IntelliSkript/SkriptTypeSection';

export class SkriptTypeState {
	possibleTypes: SkriptType[] = [];
	isArray = false;
	isLiteral = false;
	canBeEmpty = false;
	constructor(...possibleTypes: SkriptType[]) {
		this.possibleTypes = possibleTypes;
	}
	canBeInstanceOf(other: SkriptTypeState): boolean {
		for (let i = 0; i < this.possibleTypes.length; i++) {
			if (this.possibleTypes[i].regexPatternString == "unknown")
				return true;
			for (let j = 0; j < other.possibleTypes.length; j++) {
				if ((this.possibleTypes[i].section as SkriptTypeSection).instanceOf(other.possibleTypes[j])) {
					return true;
				}
			}
			//if (other.possibleTypes.includes(this.possibleTypes[i]))
			//	return true;
		}
		//for (const otherType of other.possibleTypes)
		//	if (otherType.skriptPatternString.startsWith('object'))
		//		return true;
		return false;
	}
}
