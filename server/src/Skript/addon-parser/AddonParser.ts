//import * as SkriptJson from './Addon Json/WolvSK.json';

import * as fs from 'fs';
import * as path from 'path';
import * as IntelliSkriptConstants from '../../IntelliSkriptConstants';
import * as Thread from '../../Thread';
import { Parser } from './Parser';
export class GeneralJson {
	name = "";
	description?: string[];
	examples?: string[];
	"required plugins"?: string[] | undefined;
	since?: string[];
	id = "";
}
export class PatternJson extends GeneralJson {
	patterns: string[] = [];
}

export class EffectJson extends PatternJson {
}
export class ConditionJson extends PatternJson {

}
export class EventJson extends PatternJson {
	"event values"?: string[];
	cancellable = false;
}
export class ExpressionJson extends PatternJson {
	changers?: string[];
	"return type" = "";
}

export class TypeJson extends PatternJson {
	usage?: string;
}
export class fileJson {
	effects?: EffectJson[];
	conditions?: ConditionJson[];
	events?: EventJson[];
	expressions?: ExpressionJson[];
	types?: TypeJson[];
}
export class AddonParser extends Parser {

	static override idDirectory = path.join(this.parserDirectory, "json");
	static inheritanceByID = new Map<string, string>();


	static nameToPattern(name: string) {
		return name.toLowerCase().replace(' ', '');
	}
	static parseFileJson(file: fileJson): string {
		function format(str: string): string {
			//trim() removes \n too
			str = str.replace(/#/g, "");
			str = str.replace(/<br>/g, "\n");//convert <br> to a new line
			str = str.replace(/\\n/g, "\n");//convert \m to a new line
			str = str.replace(/\n/g, "\n#");
			return str;
		}

		function generalData(elem: GeneralJson): string {
			let str = "\n#" + elem.name + "\n";
			if (elem.description) {
				elem.description.forEach(line => {
					if (line != "") {
						str += "#" + format(line) + "\n";
					}
				});
			}
			if (elem.since) {
				str += "#since ";
				str += elem.since.join(", ");
				str += "\n";
			}
			if (elem.examples != undefined) {
				str += "#Examples:\n";
				elem.examples.forEach(line => {
					if (line != "") {

						str += "#" + format(line) + "\n";
					}
				});
			}
			if (elem["required plugins"] != undefined) {
				str += "#" + elem["required plugins"] + "\n";
			}
			return str;
		}

		function patterns(elem: PatternJson, noSpaces = false): string {
			let str = "";
			str += "\tpatterns:\n";
			elem.patterns.forEach(line => {
				if (line != "") {
					if (noSpaces) {
						line = line.replace(/(?<!\[) | (?!\])/g, '[ ]');
					}
					str += "\t\t" + line + "\n";
				}
			});
			return str;
		}

		function defineType(elem: TypeJson, parents?: string): string {
			let str = "";
			str += generalData(elem);
			str += "type:\n";
			str += patterns(elem, true);
			if (parents)
				str += `\tinherits: ${parents}\n`;
			if (elem.usage) {
				const patterns = elem.usage.toLowerCase().split(",");
				if (patterns) {
					let expressionString = "\n";
					expressionString += 'expression:\n';
					expressionString += "\treturn type: " + AddonParser.nameToPattern(elem.name) + "\n";
					expressionString += "\tpatterns:\n";
					for (const pattern of patterns) {
						const invalidPatternRegex = /([^a-z \._])/g;
						if (invalidPatternRegex.test(pattern)) 
							//this was not meant as pattern list
							return str;
							expressionString += "\t\t" + pattern.trim() + "\n";
					}
					str += expressionString;
				}
			}
			return str;
		}

		let str = IntelliSkriptConstants.skriptFileHeader;
		const toDefine = new Map<string, TypeJson>();

		//define types at first as they are used in effects and other patterns

		file.types?.forEach(type => {
			const name = this.nameToPattern(type.name);
			if (this.inheritanceByID.has(name)) {
				toDefine.set(name, type);
			}
			else {
				str += defineType(type);
			}
		});
		//deriving types
		this.inheritanceByID.forEach((parents: string, name: string) => {
			if (parents != 'predefined') {
				//types should be defined in order of dependency. so types that derive from something, will need to be defined after the other type.
				const type = toDefine.get(name);
				if (type)
					str += defineType(type, parents);

				//else
				//	throw "type not found";
			}
		})
		file.effects?.forEach(effect => {
			str += generalData(effect);
			str += "effect:\n";
			str += patterns(effect);

		});
		file.conditions?.forEach(condition => {
			str += generalData(condition);
			str += "condition:\n";
			str += patterns(condition);

		});
		file.events?.forEach(event => {
			str += generalData(event);
			str += "event \"" + event.id + "\":\n";
			str += patterns(event);
			if (event["event values"]) {
				str += "\tevent-values: ";
				//str += event["event values"].join(", ");
				event["event values"].forEach((line, index) => {
					if (line != "") {
						if (index > 0) {
							str += ", ";
						}
						const eventValueParserRegExp = /(event-)?(.*)/;

						const valueName: RegExpExecArray | null = eventValueParserRegExp.exec(line);
						if (valueName) {
							str += valueName[2];
						}

					}
				});
				str += "\n";
			}

		});
		file.expressions?.forEach(expression => {
			if (expression.name != "ExprCustomEventValue") {
				str += generalData(expression);
				str += "expression:\n";
				str += patterns(expression);
				if (expression.changers) {
					expression.changers.forEach(changer => {
						str += "\t" + (changer == "unknown" ? "get" : changer) + ":\n";
						str += "#\t\t(internal code)\n";
					});
				}
				str += "\treturn type: " + expression["return type"].toLowerCase().replace(/(.*) \/ .*/, "$1");
			}
		});
		return str;
	}
	static override ParseFile(file: string, contents: string): void {
		const fileData = JSON.parse(contents);
		const parseResult = AddonParser.parseFileJson(fileData);
		const inputFileName = file.substring(0, file.indexOf('.'));
		const outputFileName = inputFileName == "Skript" ? "1 (preload) - Skript" : inputFileName;
		const targetPath = path.join(IntelliSkriptConstants.AddonSkFilesDirectory, outputFileName) + ".sk";
		fs.writeFileSync(targetPath, parseResult);
	}
	static override ParseFiles(): void {

		if (!fs.existsSync(IntelliSkriptConstants.AddonSkFilesDirectory)) {
			fs.mkdirSync(IntelliSkriptConstants.AddonSkFilesDirectory, { recursive: true });
		}
		const text = fs.readFileSync(path.join(this.parserDirectory, "inheritance.txt"), "utf8").toLocaleLowerCase();
		for (const line of text.split('\n')) {
			const parts = line.trim().split('#')[0].split('->');
			if (parts.length > 1)
				this.inheritanceByID.set(this.nameToPattern(parts[0]), parts[1]);
		}
		super.ParseFiles();
	}
}
//import { readFile } from "fs/promises";

//async function readJsonFile(path) {
//	const file = await readFile(path, "utf8");
//	return JSON.parse(file);
//  }
//
//  readJsonFile("./package.json").then((data) => {
//	console.log(data);
//  });