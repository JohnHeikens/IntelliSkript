//import { Hierarchy } from '../Hierarchy';
//import { SkriptContext } from './SkriptContext';
//import { SkriptNestHierarchy } from '../Nesting/SkriptNestHierarchy';
//import assert from 'assert';
//import { DiagnosticSeverity } from 'vscode-languageserver/node';
//
//export class SkriptPattern extends Hierarchy<SkriptPattern> {
//	patternParts: RegExp[] = [];
//
//
//	constructor(context: SkriptContext, Hierarchy?: SkriptNestHierarchy, parent?: SkriptPattern) {
//		super(parent);
//		if (!Hierarchy) {
//			Hierarchy = this.createHierarchy(context);
//		}
//		const addRegex = (start: number, end: number) => {
//			try {
//				const regexString = context.currentString.substring(start, end).replace(/((?<!\.)\+|\*|\/|\?|(?<=\[)[()](?=\]))/g, '\\$1');
//				const regex = new RegExp(regexString);
//				this.patternParts.push(regex);
//			}
//			catch {
//				context.addDiagnostic(start, end - start, "no valid regex", DiagnosticSeverity.Error);
//			}
//		};
//
//		assert(Hierarchy != undefined);
//
//		let currentPosition = Hierarchy.start;
//		for (let i = 0; i < Hierarchy.children.length; i++) {
//			if (Hierarchy.children[i].character == '[') {
//				addRegex(currentPosition, Hierarchy.children[i].start - 1);
//				currentPosition = Hierarchy.children[i].end + 1;
//			}
//		}
//		addRegex(currentPosition, Hierarchy.end);
//	}
//}