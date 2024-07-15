import { Hierarchy } from '../../Hierarchy';
import { PatternTreeNode } from '../patternTreeNode/PatternTreeNode';

//this class stores how far the match is, recursively
export class MatchProgress extends Hierarchy<MatchProgress> {
    currentNode: PatternTreeNode;
    root: PatternTreeNode;
    constructor(root: PatternTreeNode, parent? : MatchProgress, currentNode: PatternTreeNode = root){
        super(parent);
        this.currentNode = currentNode;
        this.root = root;
    }
    
}