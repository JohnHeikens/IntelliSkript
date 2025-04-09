
import { PatternData } from '../../../pattern/data/PatternData';
import { PatternTree } from '../../../pattern/PatternTree';
import { PatternType } from "../../../pattern/PatternType";
import { TokenTypes } from '../../../TokenTypes';
import { SkriptContext } from '../../validation/SkriptContext';
import { ReflectPatternContainerSection } from '../reflect/ReflectPatternContainerSection';
import { SkriptSectionGroup } from '../SkriptSectionGroup';
export class SkriptTypeSection extends ReflectPatternContainerSection {
    baseClasses: SkriptTypeSection[] = [];
    patterns: PatternData[] = [];

    constructor(parent: SkriptSectionGroup, context: SkriptContext) {
        super(parent, context);
        //if (this.patterns[0]?.skriptPatternString != 'object[s]') {
        //    const objectType = this.getTypeData('object')?.section;
        //    if (objectType)
        //        this.baseClasses.push(objectType as SkriptTypeSection);
        //}
    }
    override processLine(context: SkriptContext): void {
        if (context.currentString.startsWith('inherits: ')) {
            let currentPosition = "inherits: ".length;
            context.addToken(TokenTypes.keyword, 0, currentPosition);
            const baseClassNames = context.currentString.substring(currentPosition).split(", ");
            for (const currentBaseClassName of baseClassNames) {
                const pattern = this.parseType(context, currentPosition, currentPosition + currentBaseClassName.length);
                if (pattern) {
                    this.baseClasses.push(pattern.section as SkriptTypeSection);
                }

                currentPosition += currentBaseClassName.length + ", ".length;
            }
        }
        else {
            return super.processLine(context);
        }
    }
    override addPattern(context: SkriptContext): void {
        const pattern = PatternTree.parsePattern(context, this, PatternType.type);
        if (pattern) {
            this.patterns.push(pattern);
            context.currentSkriptFile.addPattern(pattern);
        }
    }
    getKey(): string {
        return this.patterns[0]?.skriptPatternString ?? "";
    }
    instanceOf(otherType: PatternData): boolean {
        if (otherType.regexPatternString == "object(s)?") {
            return true;//everything inherits from object
        }
        else if (otherType.section == this) {
            return true;
        }
        else {
            for (const baseClass of this.baseClasses) {
                //direct inheritance

                if (baseClass.instanceOf(otherType)) {
                    return true;
                }

            }
            return false;
        }
    }
    testBaseClasses(testFunction: (testKey: string) => boolean, testedTypes: Set<string> = new Set<string>()): boolean {
        if (!testedTypes.has(this.patterns[0]?.skriptPatternString)) {
            if (testFunction(this.getKey())) return true;
            testedTypes.add(this.patterns[0]?.skriptPatternString);

            for (const baseClass of this.baseClasses) {
                if (baseClass.testBaseClasses(testFunction, testedTypes)) return true;
            }
        }
        return false;
    }
}