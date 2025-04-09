//import * as SkriptJson from './Addon Json/WolvSK.json';

import * as fs from 'fs';
import * as path from 'path';
import { Parser, RepoDirectory } from './Parser';


export const ServerDirectory = path.join(RepoDirectory, 'server');
export const ServerAssetsDirectory = path.join(ServerDirectory, "assets");
export const AddonSkFilesDirectory = path.join(ServerAssetsDirectory, "addons");
export const skriptFileHeader = "#AUTOMATICALLY GENERATED SKRIPT FILE\n#COPYRIGHT JOHN HEIKENS\n#https://github.com/JohnHeikens/IntelliSkript\n"

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
export class ModifierJson extends PatternJson {
	"return type" = "";
}
export class ExpressionJson extends ModifierJson {
	changers?: string[];
}
export class FunctionJson extends ModifierJson {

}

export class TypeJson extends PatternJson {
	usage?: string;
}
export class SectionJson extends PatternJson {

}
export class fileJson {
	types?: TypeJson[];
	expressions?: ExpressionJson[];
	effects?: EffectJson[];
	sections?: SectionJson[];
	conditions?: ConditionJson[];
	events?: EventJson[];
	functions?: FunctionJson[];
}
export class AddonParser extends Parser {

	static override idDirectory = path.join(this.parserDirectory, "json");
	static inheritanceByID = new Map<string, string>();
	static allTypes = new Map<string, TypeJson>();

	//this function makes type names match better with the ones defined in the inheritance text file
	static normalizeName(name: string): string {
		return name.toLowerCase().replace(' ', '');
	}
	static PatternToCall(pattern: string): string {
		while (true) {
			//replace innermost braces
			const newPattern = pattern.replace(/\[[^\[\]]*\]/g, "");
			if (pattern == newPattern) break;
			pattern = newPattern;
		};
		pattern = pattern.replace(/\((.+?)\|.+?\)/g, "$1");
		pattern = pattern.split('|')[0];
		return pattern;
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
					expressionString += "\treturn type: " + AddonParser.PatternToCall(elem.patterns[0]) + "\n";
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

		let str = skriptFileHeader;
		const toDefine = new Map<string, TypeJson>();

		//define types at first as they are used in effects and other patterns

		file.types?.forEach(type => {
			this.allTypes.set(type.name, type);

			const normalizedName = this.normalizeName(type.name);
			if (this.inheritanceByID.has(normalizedName)) {
				toDefine.set(normalizedName, type);
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
		file.sections?.forEach(condition => {
			str += generalData(condition);
			str += "section:\n";
			str += patterns(condition);
		});
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
				const type = this.allTypes.get(expression["return type"]);
				str += "\treturn type: ";
				if (type) str += this.PatternToCall(type.patterns[0]);
				else str += this.normalizeName(expression["return type"]);
			}
		});
		file.functions?.forEach(f => {
			str += generalData(f);
			str += "function " + f.patterns[0] + " :: " + f['return type'] + ":\n";
			str += "#\t(internal code)\n";
		})
		return str;
	}
	static override ParseFile(file: string, contents: string): void {
		const fileData = JSON.parse(contents);
		const parseResult = AddonParser.parseFileJson(fileData);
		const inputFileName = file.substring(0, file.indexOf('.'));
		const outputFileName = inputFileName;
		const targetPath = path.join(AddonSkFilesDirectory, outputFileName) + ".sk";
		fs.writeFileSync(targetPath, parseResult);
	}
	static override ParseFiles(): void {

		if (!fs.existsSync(AddonSkFilesDirectory)) {
			fs.mkdirSync(AddonSkFilesDirectory, { recursive: true });
		}
		const text = fs.readFileSync(path.join(this.parserDirectory, "inheritance.txt"), "utf8").toLocaleLowerCase();
		for (const line of text.split('\n')) {
			const parts = line.trim().split('#')[0].split('->');
			if (parts.length > 1)
				this.inheritanceByID.set(this.normalizeName(parts[0]), parts[1]);
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