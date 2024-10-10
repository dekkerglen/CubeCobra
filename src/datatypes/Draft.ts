import Card from 'datatypes/Card';
import DraftSeat from 'datatypes/DraftSeat';

export type DraftStep = {
  action: 'pick' | 'pass' | 'burn';
  amount: number;
};
export interface PackDefinition {
  slots: string[];
  steps: DraftStep[];
}
export interface DraftFormat {
  title: string;
  packs: PackDefinition[];
  multiples: boolean;
}

export type DraftState = {
  cards: number[];
  steps: DraftStep[];
}[][];

export default interface Draft {
  seats: DraftSeat[];
  cards: Card[];
  cube: string;
  initial_state: DraftState;
  basics: number[];
  id: string;
  seed: string;
}
