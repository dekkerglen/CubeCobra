export default interface Card {
  date: number;
  cubes: number;
  elo: number;
  legacy: number[];
  modern: number[];
  pauper: number[];
  size180: number[];
  size360: number[];
  size540: number[];
  size720: number[];
  total: number[];
  oracle: string;
  picks: number;
  OTComp: string;
}