import * as SkriptJson from './addons/Skript.json';

export class AddonParser {

	static parseFile(): string {
		function format(str: string): string {
			//trim() removes \n too
			return str.replace("#", "").replace("\n", "\n#").replace("<br>", "\n#");
		}

		function generalData(elem: {
			name: string,
			description: string[] | undefined,
			examples?: string[],
			"required plugins"?: string[] | undefined
			since: string[]
		}): string {
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

		function patterns(elem: { patterns: string[] }): string {
			let str = "";
			str += "\tpatterns:\n";
			elem.patterns.forEach(line => {
				if (line != "") {

					str += "\t\t" + line + "\n";
				}
			});
			return str;
		}

		let str = "";
		SkriptJson.effects.forEach(effect => {
			str += generalData(effect);
			str += "effect:\n";
			str += patterns(effect);

		});
		SkriptJson.conditions.forEach(condition => {
			str += generalData(condition);
			str += "condition:\n";
			str += patterns(condition);

		});
		SkriptJson.events.forEach(event => {
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
		SkriptJson.expressions.forEach(expression => {
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