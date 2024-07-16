import { PatternTreeNode } from '../patternTreeNode/PatternTreeNode';

//this class stores how far the match is, recursively
export interface MatchProgress {
    currentNode: PatternTreeNode;
    root: PatternTreeNode;
    parent?: MatchProgress;
}