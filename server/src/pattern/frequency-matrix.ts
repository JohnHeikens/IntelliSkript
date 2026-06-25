import { PatternTreeNode } from './pattern-tree-node/pattern-tree-node';

export class FrequencyMatrix {
	/**a matrix with indices [from][to] containing hit counts.
	 * important: merged tree nodes don't separate hitcounts!
	 * we can't just multiply hitcounts by 0.25 if there are 4 other sources, because maybe all hits come from one source. */
	matrix = new Map<PatternTreeNode, Map<PatternTreeNode, number>>();
	/**add other matrix to this one */
	push(other: FrequencyMatrix) {
		for (const [fromNode, toMatrix] of other.matrix) {
			let selfToMatrix = this.matrix.get(fromNode);
			if (selfToMatrix) {
				for (const [toNode, frequency] of toMatrix) {
					let selfToValue = selfToMatrix.get(toNode) ?? 0;
					selfToMatrix.set(toNode, selfToValue + frequency);
				}
			}
			else {
				this.matrix.set(fromNode, toMatrix);
			}
		}
	}
	addPassedNodes(passedNodes: PatternTreeNode[]) {
		for (let toNodeIndex = 1; toNodeIndex < passedNodes.length; toNodeIndex++) {
			let fromNodeIndex = toNodeIndex - 1;
			if (!this.matrix.has(passedNodes[fromNodeIndex])) this.matrix.set(passedNodes[fromNodeIndex], new Map());
			let toMatrix = this.matrix.get(passedNodes[fromNodeIndex]);
			let frequency = toMatrix?.get(passedNodes[toNodeIndex]) ?? 0;
			toMatrix?.set(passedNodes[toNodeIndex], frequency + 1);
		}
	}
	getFrequency(fromNode: PatternTreeNode, toNode: PatternTreeNode): number {
		return this.matrix.get(fromNode)?.get(toNode) ?? 0;
	}
}

export function mergeFrequencyMatrix(addTo: Map<PatternTreeNode, Map<PatternTreeNode, number>>) {
}