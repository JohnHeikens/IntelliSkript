import path = require('path');
import * as fs from 'fs';
export class Parser {
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