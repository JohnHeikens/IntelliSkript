import assert = require('assert');
import { PatternTree } from '../../../pattern/PatternTree';
import { PatternType } from "../../../pattern/PatternType";
import { SkriptContext } from '../../SkriptContext';
import { SkriptPatternContainerSection } from '../reflect/SkriptPatternContainerSection';
import { PatternData } from '../../../pattern/data/PatternData';
import { SkriptSectionGroup } from '../SkriptSectionGroup';
export class SkriptTypeSection extends SkriptPatternContainerSection {
    baseClasses: PatternData[] = [];
    patterns: PatternData[] = [];

    constructor(parent: SkriptSectionGroup, context: SkriptContext) {
        super(parent, context);
    }
    override processLine(context: SkriptContext): void {
        if (context.currentString.startsWith('inherits: ')) {
            let currentPosition = "inherits: ".length;
            const baseClassNames = context.currentString.substring(currentPosition).split(", ");
            for (const currentBaseClassName of baseClassNames) {
                const pattern = this.parseType(context, currentPosition, currentPosition + currentBaseClassName.length);
                if (pattern) {
                    this.baseClasses.push(pattern);
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
    instanceOf(otherType: PatternData): boolean {
        if (otherType.regexPatternString == "object(s)?") {
            return true;//everything inherits from object
        }
        else if (otherType.section == this)
        {
            return true;
        }
        else {
            for (const baseClass of this.baseClasses) {
                if (baseClass.section == otherType.section) return true;//direct inheritance
                else {
                    if ((baseClass.section as SkriptTypeSection).instanceOf(otherType)) {
                        return true;
                    }
                }
            }
            return false;
        }
    }
}