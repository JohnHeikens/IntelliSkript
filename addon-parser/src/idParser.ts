
import path = require('path');
import * as fs from 'fs';
import { Parser } from './Parser';
import { AddonSkFilesDirectory, skriptFileHeader } from './AddonParser';

export class idParser extends Parser {
    static override idDirectory: string = path.join(this.parserDirectory, "ids");
    static override ParseFile(file: string, contents: string): void {
        const inputFileName = file.substring(0, file.indexOf('.'));
        let outputFileString = skriptFileHeader;
        outputFileString += "expression:\n";
        outputFileString += "\treturn type: " + inputFileName + "type\n";
        outputFileString += "\tpatterns:\n";
        const vowels = "aeiou";

        for (const line of contents.split('\n')) {
            const trimmedLine = line.trim();
            const prefix = vowels.includes(trimmedLine.substring(0, 1)) ? "[an] " : "[a] ";
            outputFileString += "\t\t" + prefix + trimmedLine + "\n";
        }

        const outputFileName = "zzz (postload) - IntelliSkript " + inputFileName.substring(0, 1).toUpperCase() + inputFileName.substring(1);
        const targetPath = path.join(AddonSkFilesDirectory, outputFileName) + ".sk";
        fs.writeFileSync(targetPath, outputFileString);
    }
}