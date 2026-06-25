import * as fs from 'fs';
import * as path from 'path';
import { ParseFile } from './parse-file';

export const currentDirectory: string = __dirname;// out directory
export const RepoDirectory = path.join(currentDirectory, "../..");
export class Parser {
	static parserDirectory: string = path.join(RepoDirectory, "addon-parser");
	static idDirectory: string;
	static ParseFile(file: ParseFile): ParseFile {
		//by default, we just return the file
		return file;
	}
	static ParseFiles(): string {

		console.log("Parsing files in " + this.idDirectory);
		const files = fs.readdirSync(this.idDirectory, undefined);
		let addonFilesString = "";

		for (const file of files) {

			const completePath = path.join(this.idDirectory, file);
			const content = fs.readFileSync(completePath, "utf8");
			const parseResult: ParseFile = this.ParseFile({ fileName: file, content: content });
			const escapedString = parseResult.content.replace(/[\`\\]/g, function (a) {
				return "\\" + a;
			});
			addonFilesString += `[\`${parseResult.fileName}\`, \`${escapedString}\`],`;
		};
		return addonFilesString;
	}
}