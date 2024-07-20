import { PatternData } from '../data/PatternData';
import { PatternTreeNode } from '../patternTreeNode/PatternTreeNode';
import { PatternType } from '../PatternType';

//this class stores how far the match is, recursively
export interface MatchProgress {
    currentNode: PatternTreeNode;
    patternType: PatternType;
    parent?: MatchProgress;
    foundPattern?: PatternData;
    start: number
}

//export function cloneProgress(toClone: MatchProgress): MatchProgress {
//    return {
//        currentNode: toClone.currentNode, 
//        parent: toClone.parent? cloneProgress(toClone.parent) : undefined,
//        root: toClone.root,
//        foundPattern: toClone.foundPattern
//    };
//    //result.children = result.children?.map(cloneProgress);
//    //if (toClone.parent)
//    //    result.parent = cloneProgress(toClone.parent);
//    //return result;
//}