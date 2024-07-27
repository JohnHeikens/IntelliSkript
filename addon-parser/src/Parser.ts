import * as path from 'path';
import * as fs from 'fs';


export const currentDirectory : string = __dirname;// out directory
export const RepoDirectory = path.join(currentDirectory, "../..");
export class Parser {
    static parserDirectory: string = path.join(RepoDirectory, "addon-parser");
    static idDirectory: string;
    static ParseFile(file: string, contents: string) {
        throw "not implemented!";
    }
    static ParseFiles() {

        console.log("Parsing files in " + this.idDirectory);
        const files = fs.readdirSync(this.idDirectory, undefined);

        for (const file of files) {

            const completePath = path.join(this.idDirectory, file);
            const contents = fs.readFileSync(completePath, "utf8");
            this.ParseFile(file, contents);
        };
    }
}