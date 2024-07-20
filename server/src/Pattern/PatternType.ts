
export enum PatternType {
	effect,
	expression,
	condition,
	event,
	type,
	count
}

export const canHaveSubPattern = (patternType:PatternType) => patternType != PatternType.type;
export const canBeSubPattern = (patternType:PatternType) => patternType == PatternType.expression;