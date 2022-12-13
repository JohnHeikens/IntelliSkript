import { SkriptExpressionSection } from './SkriptExpressionSection';
import { SkriptType } from '../../SkriptType';
import { SkriptContext } from '../../SkriptContext';
import { SkriptSection } from '../SkriptSection';
export class SkriptPropertySection extends SkriptExpressionSection {
	propertyParentType: SkriptType;
	constructor(context: SkriptContext, propertyParentType: SkriptType, parent?: SkriptSection) {
		super(context, parent);
        this.propertyParentType = propertyParentType;
	}
}