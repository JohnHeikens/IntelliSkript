import { SkriptTypeSection } from '../../skript/section/custom/SkriptTypeSection';
import { PatternTreeNode } from './PatternTreeNode'

export class TypeNode extends PatternTreeNode {
    type: SkriptTypeSection;
    derivedChildren: Map<string, TypeNode> = new Map<string, TypeNode>();
    constructor(type: SkriptTypeSection) {
        super('%');
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