//import * as SkriptJson from './Addon Json/WolvSK.json';

import { IntelliSkriptConstants } from '../../IntelliSkriptConstants';
import * as path from 'path';
import * as fs from 'fs';
export const intelliSkriptAddonSkFilesDirectory = path.join(IntelliSkriptConstants.ServerAssetsDirectory, "Addons");
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

export class TypeJson extends GeneralJson {

}
export class fileJson {
	effects?: EffectJson[];
	conditions?: ConditionJson[];
	events?: EventJson[];
	expressions?: ExpressionJson[];
	types?: TypeJson[];
}
export class AddonParser {
	static parseFileJson(file: fileJson): string {
		function format(str: string): string {
			//trim() removes \n too
			return str.replace("#", "").replace("\n", "\n#").replace("<br>", "\n#");
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

		function patterns(elem: PatternJson): string {
			let str = "";
			str += "\tpatterns:\n";
			elem.patterns.forEach(line => {
				if (line != "") {

					str += "\t\t" + line + "\n";
				}
			});
			return str;
		}

		let str = "#AUTOMATIC GENERATED SKRIPT FILE\n";
		str += "#COPYRIGHT JOHN HEIKENS\n";
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
						str += line.substring("event-".length);
					}
				});
				str += "\n";
			}

		});
		file.expressions?.forEach(expression => {
			str += generalData(expression);
			str += "expression:\n";
			str += patterns(expression);
			if (expression.changers) {
				expression.changers.forEach(changer => {
					str += "\t" + (changer == "unknown" ? "get" : changer) + ":\n";
					str += "#\t\t(internal code)\n";
				});
			}
			str += "\treturn type: " + expression["return type"];
		});
		return str;
	}
	//static parse(): void {
	//	
	//}
	static ParseFiles() {
		//remove 'out\Skript\Addon Parser\'
		//const intelliSkriptAssetsDirectory = path.resolve('Addons', "@Assets/");

		//path.resolve(__dirname + 'Addons', "@Assets/");
		if (!fs.existsSync(intelliSkriptAddonSkFilesDirectory)) {
			fs.mkdirSync(intelliSkriptAddonSkFilesDirectory, { recursive: true });
		}
		const jsonDirectory = path.join(IntelliSkriptConstants.ServerSrcDirectory, "Skript", "Addon Parser", "Addon Json");
		fs.readdir(jsonDirectory, undefined, function (err: NodeJS.ErrnoException | null, files: string[]) {

			files.forEach(function (file, index) {
				// Make one pass and make the file complete
				const completePath = path.join(jsonDirectory, file);
				//await import * as SkriptJson from "./Addon Json/" + file assert { type: "json" }
				//import("./Addon Json/" + file);
				const jsonString = fs.readFileSync(completePath, "utf8");
				const fileData = JSON.parse(jsonString);
				//if (fileData instanceof fileJson) {
				const parseResult = AddonParser.parseFileJson(fileData);
				const targetPath = path.join(intelliSkriptAddonSkFilesDirectory, file.substring(0, file.indexOf('.'))) + ".sk";
				fs.writeFileSync(targetPath, parseResult);
				//}
				//else{
				//	console.log("no valid JSON file");
				//}
			});
		});

		//const parseResult = AddonParser.parseFileJson(SkriptJson);
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