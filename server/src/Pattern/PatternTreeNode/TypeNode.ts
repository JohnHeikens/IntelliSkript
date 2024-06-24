import { SkriptTypeState } from '../../skript/storage/SkriptTypeState';
import { PatternTreeNode } from './PatternTreeNode'

export class TypeNode extends PatternTreeNode {
    type : SkriptTypeState;
    constructor(type: SkriptTypeState){
        super('%');
        this.type = type;
    }
    override compare(other : PatternTreeNode) : boolean{
        if(other instanceof TypeNode){
            //what are we comparing here?
            return (other as TypeNode).type.equals(this.type);
        }
        return false;
    }
}