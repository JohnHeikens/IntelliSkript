import path = require('path');
import * as fs from 'fs';
import * as IntelliSkriptConstants from '../../IntelliSkriptConstants';
export class Parser {
    static parserDirectory: string = path.join(IntelliSkriptConstants.ServerSrcDirectory, "skript", "addon-parser");
    static idDirectory: string;
    static ParseFile(file: string, contents: string) {
        throw "not implemented!";
    }
    static ParseFiles() {

        console.log("Parsing files in " + this.idDirectory);
        const files = fs.readdirSync(this.idDirectory, undefined);

        files.forEach((file, index) => {

            const completePath = path.join(this.idDirectory, file);
            const contents = fs.readFileSync(completePath, "utf8");
            this.ParseFile(file, contents);
        });
    }
}