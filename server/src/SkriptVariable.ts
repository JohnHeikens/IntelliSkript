import { Location, Position } from 'vscode-languageserver/node';

export class SkriptVariable{
	firstReferenceLocation : Location;
	nameString : string;//can be "_ex" or "_ex::3::%string%"
	type: string;
	constructor(firstReferenceLocation : Location, nameString : string, type : string)
	{
		this.firstReferenceLocation = firstReferenceLocation;
		this.nameString = nameString;
		this.type = type;
	}
	overlap(nameString :string) : boolean
	{
		let i = 0;
		for(; i < this.nameString.length; i++)
		{
			if(this.nameString[i] != nameString[i]) return false;
			if(i >= nameString.length) return false;
		}
		if(i < nameString.length) return false;
		return true;
	}
}