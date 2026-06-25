import { SkriptTypeState } from "../skript/storage/type/skript-type-state";
import { PatternType } from './pattern-type';
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
    /**the sort of patterns. we can check for multiple patterns at the same time */
    patternTypes = [PatternType.effect];
    /**the type the pattern is expected to return */
    returnType: SkriptTypeState;
    constructor(pattern: string, types: PatternType[], expressionArguments: SkriptTypeState[] = [], returnType: SkriptTypeState = new SkriptTypeState()) {
        this.pattern = pattern.toLowerCase();
        this.patternTypes = types;
        this.expressionArguments = expressionArguments;
        this.returnType = returnType;
    }

}