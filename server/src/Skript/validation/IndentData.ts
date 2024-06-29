import { DiagnosticSeverity, integer } from 'vscode-languageserver';
import { SkriptContext } from './SkriptContext';

function removeRemainder(toDivide: number, toDivideBy: number): number {
    return Math.floor(toDivide / toDivideBy) * toDivideBy;
}

export class IndentData {
    /**the line starts and the indentation stops here */
    endIndex: integer = 0;

    /**the indentation string, for example '\t\t', '\t' or '  '.
     * when unit is '\t\t' and the indentation is \t\t\t\t', current = 2
     */
    unit = "";

    //indentation amount in file units:
    //the actual indentation in the file, not the amount of nesting

    /**the indentation of the current line */
    current: integer = 0;
    /**the amount of indentation we would expect for this line.
     * the indentation may be lower, but not higher.
     */
    expected: integer = 0;
    /**the indent offset in file units which would be the most valid in this case
     * for example:
     * function test():
     *     function test2():
     * mostValid for test2() should return 0 here
     */
    mostValid: integer = 0;
    hasColon: boolean = false;

    /**indentation offset - correct offset; this should be 0 all the time while parsing a perfect skript file. 
     * when you paste a piece of code with some extra tabs, it will hopefully recognise the correct offset and adjust the indentation offset using this.
     * we don't need this variable, because we're just going at the indent offset we're at until it doesn't work anymore.
    */
    nestOffset: integer = 0;
    /**the correct indentation of this line*/
    correct: integer = 0;

    static getIndentationEndIndex(line: string): number {
        return line.search(/(?!( |\t))/);
    }
    nextLine(context: SkriptContext) {
        //first 'step' one line 'forward'
        this.expected = this.hasColon ? this.current + 1 : this.current;

        //then process the current line
        this.endIndex = IndentData.getIndentationEndIndex(context.currentString);
        const indentationString = context.currentString.substring(0, this.endIndex);

        const inverseCharacter = (indentationString[0] == " ") ? "\t" : " ";
        const currentExpectedIndentationcharacterCount = this.expected * this.unit.length;
        if (indentationString.includes(inverseCharacter)) {
            context.addDiagnostic(
                0,
                this.endIndex,
                `indentation error: do not mix tabs and spaces` + this.endIndex,
                DiagnosticSeverity.Error,
                "IntelliSkript->Indent->Mix",
                this.unit.repeat(this.expected)
            );
        }
        else {
            if (indentationString == "") {
                this.unit = "";
                this.current = 0;
            }
            else if (this.unit == "") {
                this.unit = indentationString;
                this.current = 1;
                //    stacksToPop = this.expected;
                //    //popStacks(this.expected);
                //    //this.expected = 0;
                //}
            }
            else {
                const inverseExpectedIndentationCharacter = this.unit[0] == " " ? "\t" : " ";
                if (indentationString[0] == inverseExpectedIndentationCharacter) {
                    context.addDiagnostic(
                        0,
                        this.endIndex,
                        `indentation error: expected ` + currentExpectedIndentationcharacterCount + (this.unit[0] == " " ? " space" : " tab") + (currentExpectedIndentationcharacterCount == 1 ? "" : "s") + ` but found ` + this.endIndex + (indentationString[0] == " " ? " space" : " tab") + ((indentationString.length == 1) ? "" : "s"),
                        DiagnosticSeverity.Error,
                        "IntelliSkript->Indent->Charachter",
                        this.unit.repeat(this.expected)
                    );
                }
                else {
                    if ((this.endIndex > currentExpectedIndentationcharacterCount) || (this.endIndex % this.unit.length) != 0) {
                        const withoutRemainder = removeRemainder(this.endIndex, this.unit.length);
                        this.current = withoutRemainder / this.unit.length;
                        const difference = this.endIndex - withoutRemainder;
                        context.addDiagnostic(
                            removeRemainder(this.endIndex, this.unit.length),
                            difference,
                            `indentation error: expected ` + currentExpectedIndentationcharacterCount + (this.unit[0] == " " ? " space" : " tab") + (currentExpectedIndentationcharacterCount == 1 ? "" : "s") + ` but found ` + this.endIndex,
                            DiagnosticSeverity.Error,
                            "IntelliSkript->Indent->Amount",
                            this.unit.repeat(this.expected)
                        );
                        //process the line like normally. this way the next lines will not all generate errors messages.
                        //break cont;
                    }
                    else {
                        //proper indentation!
                        this.current = this.endIndex / this.unit.length;
                        if (indentationString == "")
                            this.unit = '';

                        //stacksToPop = this.expected - currentIndentationCount;
                        //popStacks(StacksToPop);
                        //this.expected = currentIndentationCount;
                    }
                }
            }
        }
        //it's impossible to go up one or more tabs out of nowhere
        this.mostValid = Math.min(this.expected, this.current);
        //it's also impossible to go beyond the file border
        this.mostValid = Math.max(this.mostValid, this.nestOffset);
    }
    finishLine() {
        //process mostvalid
        this.nestOffset += this.current - this.mostValid;
        this.correct = this.current - this.nestOffset;
    }
}