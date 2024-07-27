import CardDataPoint from 'datatypes/CardDataPoint';

export interface History {
  date: string;
  data: CardDataPoint;
}

export default interface CardHistory {
  cardName: string;
  oracleId: string;
  versions: string[];
  current?: CardDataPoint;
  cubedWith?: {
    synergistic: string[];
    top: string[];
    creatures: string[];
    spells: string[];
    other: string[];
  };
  history: History[];
}