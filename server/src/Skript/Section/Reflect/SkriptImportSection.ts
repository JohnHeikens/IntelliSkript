import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../skriptSection/SkriptSection';

//TODO: add support for options
export class SkriptImportSection extends SkriptSection {
	processLine(context: SkriptContext): void {
		const regex = /^[a-z]{1,}(\.([a-zA-Z0-9_]{1,})){1,}(|\$([a-zA-Z0-9_]){1,})(| as .*)$/; // /function ([a-zA-Z0-9]{1,})\(.*)\) :: (.*)/;
		const result = regex.exec(context.currentString);
		if (result == null){
			context.addDiagnostic(0, context.currentString.length, "is this an import? (for example java.util.UUID fits here)");
		}
	}
	
	override createSection(context: SkriptContext): SkriptSection {
		context.addDiagnostic(0, context.currentString.length, "this is an import section");
		return super.createSection(context);
	}
}