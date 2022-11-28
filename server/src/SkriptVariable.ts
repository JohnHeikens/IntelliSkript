import { Position } from 'vscode-languageserver/node';

export class SkriptVariable{
	firstReferenceLocation : Position;
	constructor(firstReferenceLocation : Position)
	{
		this.firstReferenceLocation = firstReferenceLocation;
	}
}