import assert = require('assert');
import { PatternTree } from '../../../Pattern/PatternTree';
import { PatternType } from "../../../Pattern/PatternType";
import { SkriptContext } from '../../SkriptContext';
import { SkriptPatternContainerSection } from '../Reflect/SkriptPatternContainerSection';
import { PatternData } from '../../../Pattern/Data/PatternData';
import { SkriptSectionGroup } from '../SkriptSectionGroup';
export class SkriptTypeSection extends SkriptPatternContainerSection {
    baseClasses: PatternData[] = [];
    patterns: PatternData[] = [];

    constructor(context: SkriptContext, parent?: SkriptSectionGroup) {
        super(context, parent);
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
            assert(context.currentSkriptFile != undefined);
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