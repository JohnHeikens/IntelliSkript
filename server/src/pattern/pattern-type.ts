
export enum PatternType {
	effect,
	expression,
	condition,
	event,
	type,
	count
}

export const SubstitutablePatterns = [PatternType.expression, PatternType.type];

export const canHaveSubPattern = (patternType:PatternType) => patternType != PatternType.type;
//type can be a subpattern as literal
export const canBeSubPattern = (patternType:PatternType) => SubstitutablePatterns.includes(patternType);