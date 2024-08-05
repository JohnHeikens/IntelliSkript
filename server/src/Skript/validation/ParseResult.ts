import { Diagnostic } from 'vscode-languageserver/node';
import { semanticTokenContainer, SemanticTokenLine } from '../section/UnOrderedSemanticTokensBuilder';

export class ParseResult {

    /**	diagnostics will be added to this list.
     * normally it'll be collected to the currentSkriptFile, but sometimes we need to try something and see if it works.
     * if it doesn't work, we don't add the diagnostics.
    */

    diagnostics: Diagnostic[] = [];
    tokens: semanticTokenContainer;
    constructor(tokens: semanticTokenContainer = new SemanticTokenLine())
    {
        this.tokens = tokens;
    }
}