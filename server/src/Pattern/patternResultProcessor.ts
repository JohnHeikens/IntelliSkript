import { PatternData } from './data/PatternData';


export type PatternResultProcessor = (patternFound: PatternData) => boolean;

export const stopAtFirstResultProcessor : PatternResultProcessor = (patternFound: PatternData) => false;
