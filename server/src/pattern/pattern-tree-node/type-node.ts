import { SkriptTypeSection } from '../../skript/section/custom/skript-type-section';
import { PatternTreeNode } from './pattern-tree-node';

export class TypeNode extends PatternTreeNode {
	type: SkriptTypeSection;
	constructor(type: SkriptTypeSection) {
		super();
		this.type = type;
	}
	//override compare(other : PatternTreeNode) : boolean{
	//    if(other instanceof TypeNode){
	//        //what are we comparing here?
	//        return (other as TypeNode).type.equals(this.type);
	//    }
	//    return false;
	//}
}