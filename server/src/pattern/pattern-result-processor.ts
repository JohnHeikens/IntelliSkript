import { PatternData } from './data/pattern-data';


export type PatternResultProcessor = (patternFound: PatternData) => boolean;