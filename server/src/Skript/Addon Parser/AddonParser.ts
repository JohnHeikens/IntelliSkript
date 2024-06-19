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

}
export class fileJson {
	effects?: EffectJson[];
	conditions?: ConditionJson[];
	events?: EventJson[];
	expressions?: ExpressionJson[];
	types?: TypeJson[];
}
export class AddonParser extends Parser {
	
	static override idDirectory = path.join(IntelliSkriptConstants.ServerSrcDirectory, "Skript", "Addon Parser", "Addon Json");
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

		let str = IntelliSkriptConstants.skriptFileHeader;
		//define types at first as they are used in effects and other patterns
		file.types?.forEach(type => {
			str += generalData(type);
			str += "type:\n";
			str += patterns(type, true);
			switch (type.name) {
				case "Player":
					str += "\tinherits: offline player, entity, command sender";
					break;
				case "Living Entity":
					str += "\tinherits: entity";
					break;
			}
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