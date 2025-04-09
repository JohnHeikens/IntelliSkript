import { TokenTypes } from "../../TokenTypes";
import { SkriptContext } from "../validation/SkriptContext";
import { SkriptSection } from "./skriptSection/SkriptSection";

export class SkriptAliasesSection extends SkriptSection {
	processLine(context: SkriptContext): void {
		const parts = context.currentString.split(/ = /);
		context.addToken(TokenTypes.regexp, 0, parts[0].length);
	}
}