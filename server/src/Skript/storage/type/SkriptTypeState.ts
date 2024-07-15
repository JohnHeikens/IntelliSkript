import { TypeData } from '../../../pattern/data/PatternData';
import { SkriptTypeSection } from '../../section/custom/SkriptTypeSection';

export class SkriptTypeState {
	//can be multiple types, like %string/number%
	possibleTypes: TypeData[] = [];
	isArray = false;
	isLiteral = false;
	canBeEmpty = false;
	constructor(...possibleTypes: TypeData[]) {
		this.possibleTypes = possibleTypes;
	}
	/**
	 * 
	 * @param possibleBase the base type state to compare to
	 * @returns if this type state could be an instance of the base typestate
	 */
	canBeInstanceOf(possibleBase: SkriptTypeState): boolean {

		//if (other.possibleTypes.includes(this.possibleTypes[i]))
		//	return true;
		for (const derivedType of this.possibleTypes) {
			if (derivedType.regexPatternString == "unknown")
				return true;
			for (const baseType of possibleBase.possibleTypes) {
				if (baseType.regexPatternString == "unknown" ||
					(derivedType.section as SkriptTypeSection).instanceOf(baseType))
					return true;
			}
		}
		return false;
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

	/**
	 * 
	 * @param testFunction this function will be called with the current type section we're iterating over
	 * @param testedTypes this set will be modified! it stores all types we iterated over
	 * @returns true if all types should be checked
	 */
	iterateBaseClasses(testFunction: (testType: SkriptTypeSection) => boolean, testedTypes: Set<string> = new Set<string>()): boolean {
		let testAllTypes = false;
		for (const type of this.possibleTypes) {
			if (type.regexPatternString == "unknown") {
				//test all types
				testAllTypes = true;
			}
			else if (type.section) {
				if ((type.section as SkriptTypeSection).testBaseClasses(testFunction, testedTypes)) return true;
			}
		}
		return testAllTypes;
	}
}
