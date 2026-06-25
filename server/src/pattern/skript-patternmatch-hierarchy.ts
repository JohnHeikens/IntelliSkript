import { NestHierarchy } from '../nesting/nest-hierarchy';
import { PatternData } from '../pattern/data/pattern-data';
export class SkriptPatternMatchHierarchy extends NestHierarchy<SkriptPatternMatchHierarchy>{
	matchedPattern?: PatternData;
	constructor(start?: number, end?: number, matchedPattern?: PatternData) {
		super(start, end);
		this.matchedPattern = matchedPattern;
	}
}