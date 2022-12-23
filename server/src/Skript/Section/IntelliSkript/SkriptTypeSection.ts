import assert = require('assert');
import { PatternTree } from '../../../Pattern/PatternTree';
import { PatternType } from "../../../Pattern/PatternType";
import { SkriptContext } from '../../SkriptContext';
import { SkriptPatternContainerSection } from '../Reflect/SkriptPatternContainerSection';
export class SkriptTypeSection extends SkriptPatternContainerSection {
    override addPattern(context: SkriptContext): void {
        const pattern = PatternTree.parsePattern(context, this, PatternType.type);
        if (pattern) {
            assert (context.currentSkriptFile != undefined);
            context.currentSkriptFile.addPattern(pattern);
            //context.currentSkriptFile.addPattern(context, this, PatternType.type);
        }
    }
}