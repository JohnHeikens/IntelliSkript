import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, SemanticTokens, SemanticTokensBuilder, SemanticTokensDelta } from 'vscode-languageserver/node';
import * as IntelliSkriptConstants from '../../IntelliSkriptConstants';
import { TokenModifiers } from '../../TokenModifiers';
import { TokenTypes } from '../../TokenTypes';



export class SemanticToken {
	static modToFlags(modifiers: TokenModifiers[]) {
		let flag = 0;
		for (const mod of modifiers)
			flag |= 1 << mod;
		return flag;
	}
	position: Position;
	length: number;
	type: TokenTypes;
	tokenModifierFlags: number;
	constructor(position: Position, length: number, type: TokenTypes, tokenModifierFlags: number) {
		this.position = position;
		this.length = length;
		this.type = type;
		this.tokenModifierFlags = tokenModifierFlags;
	}
	clone(): SemanticToken {
		return new SemanticToken({ line: this.position.line, character: this.position.character }, this.length, this.type, this.tokenModifierFlags);
	}
	toString() {
		return "type: " + TokenTypes[this.type] + ", start: " + this.position.character + ", length: " + this.length;
	}
}

export class semanticTokenContainer {
	/**caution! do not insert overlapping tokens! */
	push(_token: SemanticToken): void {

	}
}

export class SemanticTokenLine {
	tokens: SemanticToken[] = [];
	fixTokens() {
		//sort tokens
		this.tokens.sort((a, b) =>
			a.position.character - b.position.character
		);
	}
	push(token: SemanticToken): void {
		const checkTokens = IntelliSkriptConstants.IsDebugMode && true;
		if (token.length > 0) {
			const lineTokens = this.tokens;
			if (checkTokens) {
				//check if no tokens overlap
				for (const lineToken of lineTokens) {
					if ((token.position.character + token.length > lineToken.position.character) &&
						(lineToken.position.character + lineToken.length > token.position.character))
						throw "token overlap";
				}
			}
			this.tokens.push(token);
		}
		else if(checkTokens && token.length < 0)
		{
			throw "token with negative length";
		}
	}
}
export class UnOrderedSemanticTokensBuilder {
	private _builder: SemanticTokensBuilder = new SemanticTokensBuilder();

	lines: SemanticTokenLine[] = [];
	//this way, you are required to provide the most recent document
	startNextBuild(document: TextDocument) {
		this.lines = new Array<SemanticTokenLine>(document.getText().split("\n").length);
	}

	constructor(linkedDocument: TextDocument) {
		this.startNextBuild(linkedDocument);
	}

	push(token: SemanticToken): void {
		if (token.position.line >= this.lines.length) {
			throw new Error(token.position.line + " is out of bounds of the file (has " + this.lines.length + " lines )");
		}
		if (token.length > 0) {
			if (this.lines[token.position.line] == undefined) {
				this.lines[token.position.line] = new SemanticTokenLine();
			}

			this.lines[token.position.line].push(token);
		}
	}
	addLine(line: SemanticTokenLine): void {
		if (line.tokens.length) {
			const existingLine = this.lines[line.tokens[0].position.line];
			if (!existingLine)
				this.lines[line.tokens[0].position.line] = line;

			else for (const token of line.tokens)
				existingLine.push(token);

		}
	}
	previousResult(id: string): void {
		this._builder.previousResult(id);
	}
	private pushSorted(): void {
		//let modifierCounter: number = 0;
		for (let i = 0; i < this.lines.length; i++) {
			if (this.lines[i]) {
				this.lines[i].fixTokens();
				//const sortedTokens = this.lines[i].tokens.sort((a, b) => {
				//	return a.position.character - b.position.character;
				//});
				////add the sorted tokens to the token map
				////may cause problems with overlapping tokens
				this.lines[i].tokens.forEach(token =>
					this._builder.push(token.position.line, token.position.character, token.length, token.type, token.tokenModifierFlags)// 1 << (modifierCounter++ % TokenModifiers.length))//(1 << TokenModifiers.length) - 1)
				);
			}
		}

		//this.lines = [];
	}
	buildEdits(): SemanticTokens | SemanticTokensDelta {
		this.pushSorted();
		return this._builder.buildEdits();
	}
	build(): SemanticTokens {
		this.pushSorted();
		return this._builder.build();
	}
}