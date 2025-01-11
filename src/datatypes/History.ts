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

export default interface History extends Record<CubeType, [number, number] | undefined> {
  date: number;
  cubes: number;
  elo: number;
  oracle: string;
  picks: number;
  OTComp: string;
}
