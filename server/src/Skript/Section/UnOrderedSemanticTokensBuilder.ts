import { Position, SemanticTokens, SemanticTokensBuilder, SemanticTokensDelta } from 'vscode-languageserver/node';
import { TokenTypes } from '../../TokenTypes';
import { TokenModifiers } from '../../TokenModifiers';

export class SemanticToken {
	position: Position;
	length: number;
	type: TokenTypes;
	modifier: TokenModifiers = TokenModifiers.abstract;
	constructor(position: Position, length: number, type: TokenTypes, modifier: TokenModifiers = TokenModifiers.abstract) {
		this.position = position;
		this.length = length;
		this.type = type;
		this.modifier = modifier;
	}
}

export class UnOrderedSemanticTokensBuilder {
	private _builder: SemanticTokensBuilder = new SemanticTokensBuilder();
	tokens: SemanticToken[] = [];
	push(token: SemanticToken): void {
		this.tokens.push(token);
	}
	previousResult(id: string): void {
		this._builder.previousResult(id);
	}
	private pushSorted(): void {
		const sortedTokens = this.tokens.sort((a, b) => {
			if (a.position.line != b.position.line)
				return a.position.line - b.position.line;
			else {
				return a.position.character - b.position.character;
			}
		});

		//add the sorted tokens to the token map
		//may cause problems with overlapping tokens
		sortedTokens.forEach(token =>
			this._builder.push(token.position.line, token.position.character, token.length, token.type, token.modifier)
		);
		this.tokens = [];
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