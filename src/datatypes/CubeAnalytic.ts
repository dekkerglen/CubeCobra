interface Card {
  cardName?: string;
  picks: number;
  passes: number;
  elo: number;
  mainboards: number;
  sideboards: number;
}

export default interface CubeAnalytic {
  cube: string;
  cards: Card[];
  useCubeElo?: boolean;
}