import Card from './Card';

export type PlayerList = {
  name: string;
  userId?: string; // User ID is optional for users without an account
}[];

export interface UnhydratedRecord {
  id: string;
  cube: string;
  date: number;
  name: string;
  description: string;
  state: 'playing' | 'complete';
  players: PlayerList;
  matches: {
    p1: string;
    p2: string;
    results: [number, number, number];
  }[];
  trophy: string;
}

export default interface Record extends UnhydratedRecord {
  cards: Card[];
}
