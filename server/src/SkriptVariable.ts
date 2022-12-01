import { Location, Position } from 'vscode-languageserver/node';

//TODO: use skripthierarchy here
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
    /**
	 * checks if a variable with the name nameString could possibly reference to the same variable
     * for example, var::1 should overlap var::* but var::1 shouldn't overlap var::2
     * @param nameString the string to check for overlap
     */
	overlap(nameString: string): boolean {
		const pattern = SkriptVariable.convertNameStringToPattern(nameString);


		const parts1 = pattern.split('::');
		const parts2 = this.namePattern.split('::');
		if(parts1.length != parts2.length) return false;
		if(parts1.length == 1) return pattern == this.namePattern;
		for (let i = 0; i < parts1.length; i++) {
			if(parts1[i] != parts2[i]){
				if(i < parts1.length - 1){
					return false;
				}
				else{
					return (parts1[i] == '*') || (parts2[i] == '*');
				}
			}
		}
		return true;
		//let i = 0;
		//for (; i < this.namePattern.length; i++) {
		//	if (this.namePattern[i] != pattern[i]) return false;
		//	if (i >= pattern.length) return false;
		//}
		//if (i < pattern.length) return false;
		//return true;
	}
}