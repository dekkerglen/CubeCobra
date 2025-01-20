export type CubeType =
  | 'legacy'
  | 'modern'
  | 'pauper'
  | 'vintage'
  | 'peasant'
  | 'size180'
  | 'size360'
  | 'size450'
  | 'size540'
  | 'size720'
  | 'cubeCount'
  | 'total';

export enum Period {
  MONTH = 'month',
  WEEK = 'week',
  DAY = 'day',
}

//Type related directly to DynamoDB
export interface UnhydratedCardHistory extends Record<CubeType, [number, number] | undefined> {
  OTComp: string; //Oracle id colon Period
  oracle: string;
  date: number;
  elo: number;
  picks: number;
}

//This History is not related to CardHistory
export default interface History extends UnhydratedCardHistory {
  cubes: number;
}
