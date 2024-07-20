import { SkriptTypeState } from "../skript/storage/type/SkriptTypeState";
import { PatternType } from './PatternType';
import { PatternData } from './data/PatternData';
import { PatternMatch } from './match/PatternMatch';
import { MatchResult } from './match/matchResult';
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
    /**the pattern in lower case!*/
    pattern: string;
    /**the sort of pattern */
    patternType = PatternType.effect;
    /**the type the pattern is expected to return */
    returnType: SkriptTypeState;
    constructor(pattern: string, type: PatternType, expressionArguments: SkriptTypeState[] = [], returnType: SkriptTypeState = new SkriptTypeState()) {
        this.pattern = pattern.toLowerCase();
        this.patternType = type;
        this.expressionArguments = expressionArguments;
        this.returnType = returnType;
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
    compare(testPattern: PatternData): MatchResult | undefined {
        //const results = new MatchResult(this);
        //if (this.compareArgumentTypes(testPattern)) {
        //    //make sure it matches exactly
        //    const result = testPattern.patternRegExp.exec(this.pattern);// new RegExp(`^${testPattern.regexPatternString}$`).test(this.pattern);
        //    if (result) {
        //        results.addMatch(new PatternMatch(testPattern, 0, result[0].length));
        //    }
        //}
        //return results;
        return undefined;
    }
    compareCalls(other: SkriptPatternCall): boolean {
        if (this.patternType == other.patternType &&
            this.expressionArguments.length == other.expressionArguments.length &&
            this.pattern == other.pattern) {
            for (let index = 0; index < this.expressionArguments.length; index++) {
                if (this.expressionArguments[index] != other.expressionArguments[index])
                    return false;

            }
        }
        else {
            return false;
        }
        return true;
    }
}