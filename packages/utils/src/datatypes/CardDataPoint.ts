import CardPrice from './CardPrice';

export default interface CardDataPoint {
  prices: CardPrice[];
  vintage: number[];
  legacy: number[];
  modern: number[];
  standard: number[];
  pauper: number[];
  peasant: number[];
  size180: number[];
  size360: number[];
  size450: number[];
  size540: number[];
  size720: number[];
  total: number[];
}
