import {
	SkriptContext
} from './SkriptContext';

export class SkriptSection {
	childSections: Array<SkriptSection>;
	parent: SkriptSection | undefined;
	constructor(parent: SkriptSection | undefined) {
		this.childSections = new Array<SkriptSection>();
		this.parent = parent;
	}

	processLine(context: SkriptContext): void {

		const checkPattern = /check \[(?!\()(.*?)\]/g;
		let p: RegExpExecArray | null;
		while ((p = checkPattern.exec(context.currentString))) {
			context.addDiagnostic(
				context.currentPosition + p.index + "check [".length,
				p[1].length,
				`add braces around here to increase skript (re)load performance`);
		}
	}
	createSection(context: SkriptContext): SkriptSection {
		return new SkriptSection(this);
	}
}