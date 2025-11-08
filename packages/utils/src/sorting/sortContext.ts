export const SortDirections: string[] = ['ascending', 'descending'];
export type SortDirectionsType = (typeof SortDirections)[number];

export interface SortConfig {
  key: string;
  direction: SortDirectionsType;
}
