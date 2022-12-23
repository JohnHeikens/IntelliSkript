import { TextDocument } from 'vscode-languageserver-textdocument';
import { PatternData } from "../../Pattern/PatternData";
import { PatternResultProcessor } from "../../Pattern/patternResultProcessor";
import { PatternTreeContainer } from '../PatternTreeContainer';
import { PatternType } from "../../Pattern/PatternType";
import { SkriptContext } from '../SkriptContext';
import { SkriptFile } from './SkriptFile';
import { SkriptSectionGroup } from './SkriptSectionGroup';
import { SkriptPatternCall } from '../../Pattern/SkriptPattern';

export class SkriptWorkSpace extends SkriptSectionGroup {
	//the 'childsections' variable is not used here. TODO somehow merge the childsections and files variable
	files: SkriptFile[] = [];
	uri?= "";
	patterns: PatternTreeContainer = new PatternTreeContainer();
	override parent?: SkriptWorkSpace | undefined;

	validateTextDocument(document: TextDocument, context: SkriptContext): void {
		const fileIndex = this.getSkriptFileIndexByUri(document.uri);
		if (fileIndex != undefined) {
			//temporarily delete (it's recalculating) so an error will be thrown if anything ever tries accessing a recalculating file
			context.currentBuilder = this.files[fileIndex].builder;
			delete this.files[fileIndex];
			this.patterns = new PatternTreeContainer();
			for (let i = 0; i < this.files.length; i++) {
				if(i != fileIndex){
					this.patterns.merge(this.files[i].patterns);
				}
			}

			const currentFile = new SkriptFile(this, context);
			this.files[fileIndex] = currentFile;
		}
		else {
			//add document to skript workspace
			this.files.push(new SkriptFile(this, context));
		}

	}

	constructor(parent?: SkriptWorkSpace, workSpaceUri?: string) {
		super();
		this.parent = parent;
		this.uri = workSpaceUri;
	}

	override getPatternData(testPattern: SkriptPatternCall, shouldContinue: PatternResultProcessor): PatternData | undefined {
	//override getPatternData(pattern: string, shouldContinue: PatternResultProcessor, type: PatternType): PatternData | undefined {
		const result = this.patterns.getPatternData(testPattern, shouldContinue);
		return result ? result : super.getPatternData(testPattern, shouldContinue);
	}

	//override getVariableByName(name: string): SkriptVariable | undefined {
	//	for (const file of this.files) {
	//		const result = file.getVariableByName(name);
	//		if (result != undefined) return result;
	//	}
	//	return undefined;
	//}
	getSkriptFileIndexByUri(uri: string): number | undefined {
		for (let i = 0; i < this.files.length; i++) {
			if (this.files[i].document.uri == uri) return i;
		}
		return undefined;
	}
	getSkriptFileByUri(uri: string): SkriptFile | undefined {
		const index = this.getSkriptFileIndexByUri(uri);
		return index == undefined ? undefined : this.files[index];
	}
}