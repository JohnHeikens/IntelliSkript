import { SkriptTypeState } from "../Skript/SkriptTypeState";
import { PatternType } from './PatternType';
import { PatternData } from './PatternData';
//examples:
//  "set %objects% to %objects%"
//  |
//  V
//  {
//      pattern: "set % to %""
//      arguments: [
//          {
//              type: "object",
//              isArray: true
//          },
//          {
//              type: "object",
//              isArray: true
//          }
//      ]
//  }
export class SkriptPatternCall {
    expressionArguments: SkriptTypeState[];
    pattern: string;
    type = PatternType.effect;
    constructor(pattern: string, type: PatternType, expressionArguments: SkriptTypeState[] = []) {
        this.pattern = pattern;
        this.type = type;
        this.expressionArguments = expressionArguments;
    }

    //test this on expressionPattern
    compareArgumentTypes(expressionPattern: PatternData): boolean {
        //testpattern may be longer than the expression but that's okay
        if (this.expressionArguments.length < expressionPattern.expressionArguments.length) {
            return false;
        }
        else {
            for (let i = 0; i < expressionPattern.expressionArguments.length; i++) {
                if (!this.expressionArguments[i].canBeInstanceOf(expressionPattern.expressionArguments[i])) {
                    return false;
                }
            }
            return true;
        }
    }
    compare(testPattern: PatternData): boolean {
        if (this.compareArgumentTypes(testPattern)) {
            return testPattern.patternRegExp.test(this.pattern);
        }
        else {
            return false;
        }
    }
}