import { TypeData } from '../pattern/data/PatternData';
import { SkriptTypeSection } from './section/intelliSkript/SkriptTypeSection';

export class SkriptTypeState {
	//can be multiple types, like %string/number%
	possibleTypes: TypeData[] = [];
	isArray = false;
	isLiteral = false;
	canBeEmpty = false;
	constructor(...possibleTypes: TypeData[]) {
		this.possibleTypes = possibleTypes;
	}
	isInstanceOf(other: SkriptTypeState): boolean {
		for (let i = 0; i < this.possibleTypes.length; i++)
			for (let j = 0; j < other.possibleTypes.length; j++)
				if ((this.possibleTypes[i].section as SkriptTypeSection).instanceOf(other.possibleTypes[j]))
					return true;


		return false;
	}
	isUnKnown(): boolean {
		for (let i = 0; i < this.possibleTypes.length; i++)
			if (this.possibleTypes[i].regexPatternString == "unknown")
				return true;
		return false;
	}
	canBeInstanceOf(other: SkriptTypeState): boolean {

		//if (other.possibleTypes.includes(this.possibleTypes[i]))
		//	return true;

		return this.isInstanceOf(other) ||
			other.isInstanceOf(this) ||
			this.isUnKnown() ||
			other.isUnKnown();
		//for (const otherType of other.possibleTypes)
		//	if (otherType.skriptPatternString.startsWith('object'))
		//		return true;
	}
	equals(other: SkriptTypeState): boolean {
		outerLoop: for (let i = 0; i < this.possibleTypes.length; i++) {
			const t = this.possibleTypes[i];
			for (let j = 0; j < other.possibleTypes.length; j++) {
				if (t.equals(other.possibleTypes[j])) {
					continue outerLoop;
				}
			}
			return false;
		}
		return true;
	}
}
