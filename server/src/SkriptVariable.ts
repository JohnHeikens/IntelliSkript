import { Location, Position } from 'vscode-languageserver/node';

export class SkriptVariable {
	firstReferenceLocation: Location;
	namePattern: string;//can be "_ex" or "_ex::3::%string%"
	type: string;
	static convertNameStringToPattern(name: string) : string{
		let nestLevel = 0;
		//let startIndex: number | undefined = undefined;
		let pattern = "";
		for (let i = 0; i < name.length; i++) {
			const currentChar = name.charAt(i);
			if (currentChar == '%') {
				if (nestLevel == 1) {
					nestLevel = 0;
					pattern += '*';
				}
				else {
					//if (nestLevel == 0) startIndex = i;
					nestLevel++;
				}
			}
			else if (nestLevel == 0) {
				pattern += currentChar;
			}
		}
		return pattern;
	}
	constructor(firstReferenceLocation: Location, nameString: string, type: string) {
		this.firstReferenceLocation = firstReferenceLocation;
		this.namePattern = SkriptVariable.convertNameStringToPattern(nameString);
		this.type = type;
	}
	overlap(nameString: string): boolean {
		const pattern = SkriptVariable.convertNameStringToPattern(nameString);
		let i = 0;
		for (; i < this.namePattern.length; i++) {
			if (this.namePattern[i] != pattern[i]) return false;
			if (i >= pattern.length) return false;
		}
		if (i < pattern.length) return false;
		return true;
	}
}