import { PatternData } from './Data/PatternData';


export type PatternResultProcessor = (patternFound: PatternData) => boolean;

export const stopAtFirstResultProcessor : PatternResultProcessor = (patternFound: PatternData) => false;
