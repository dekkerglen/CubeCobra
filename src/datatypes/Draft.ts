import Card from './Card';
import DraftSeat from './DraftSeat';
import User from './User';

export type DraftAction = 'pick' | 'pass' | 'trash' | 'pickrandom' | 'trashrandom' | 'endpack';

export type DraftStep = {
  action: DraftAction;
  amount: number | null;
};
export interface Pack {
  slots: string[];
  steps: DraftStep[] | null;
}
export interface DraftFormat {
  title: string;
  packs: Pack[];
  multiples: boolean;
  markdown?: string;
  html?: string;
  defaultSeats: number;
}

export type DraftState = {
  cards: number[];
  steps: DraftStep[];
}[][];

//TODO: Move to Draftmancer types
export interface DraftmancerPick {
  booster: number[];
  pick: number;
}

export interface DraftmancerLog {
  sessionID: string;
  players: DraftmancerPick[][];
}

export default interface Draft {
  seats: DraftSeat[];
  cards: Card[];
  cube: string;
  InitialState?: DraftState;
  DraftmancerLog?: DraftmancerLog;
  basics: number[];
  id: string;
  seed?: string;
  // g: grid, d: draft, u: upload, s: sealed
  type: 'g' | 'd' | 'u' | 's';
  owner?: string | User;
  cubeOwner: string | User;
  date: Date | number;
  name: string;
  complete: boolean;
}
