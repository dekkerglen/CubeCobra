export type PlayerList = {
  name: string;
  userId?: string; // User ID is optional for users without an account
}[];

export interface Match {
  p1: string;
  p2: string;
  results: [number, number, number];
}
export interface Round {
  matches: Match[];
}

export default interface Record {
  id: string;
  cube: string;
  date: number;
  name: string;
  description: string;
  players: PlayerList;
  matches: Round[]; // Array of rounds, each containing matches
  draft?: string; // Draft ID, if not present we haven't uploaded the decklist data yet
  trophy: string[];
}
