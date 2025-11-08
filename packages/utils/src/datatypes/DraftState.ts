import { DraftStep } from './Draft';

export interface Seat {
  picks: number[];
  trashed: number[];
  pack: number[];
}

export interface State {
  seats: Seat[];
  stepQueue: DraftStep[];
  pack: number;
  pick: number;
}
