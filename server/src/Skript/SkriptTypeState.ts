import { SkriptType } from './SkriptType';

export class SkriptTypeState {
	possibleTypes: SkriptType[] = [];
	isArray = false;
	isLiteral = false;
	canBeEmpty = false;
	constructor(...possibleTypes: SkriptType[]) {
		this.possibleTypes = possibleTypes;
	}
	overlaps(other: SkriptTypeState): boolean {
		for (let i = 0; i < this.possibleTypes.length; i++) {
			if (other.possibleTypes.includes(this.possibleTypes[i]))
				return true;
			else if (this.possibleTypes[i].skriptPatternString.startsWith('object'))
				return true;
		}
		for (const otherType of other.possibleTypes)
			if (otherType.skriptPatternString.startsWith('object'))
				return true;
		return false;
	}
}
