import { NestHierarchy } from '../nesting/NestHierarchy';
import { PatternData } from "../pattern/data/PatternData";
export class SkriptPatternMatchHierarchy extends NestHierarchy<SkriptPatternMatchHierarchy>{
	matchedPattern?: PatternData;
	constructor(start?: number, end?: number, matchedPattern?: PatternData) {
		super(start, end);
		this.matchedPattern = matchedPattern;
	}
}