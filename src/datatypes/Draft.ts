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

export const DEFAULT_STEPS: DraftStep[] = [
  { action: 'pick', amount: 1 },
  { action: 'pass', amount: null },
];

export const DEFAULT_PACK: Pack = Object.freeze({ slots: [''], steps: DEFAULT_STEPS });

export const buildDefaultSteps: (cards: number) => DraftStep[] = (cards) => {
  // the length should be cards*2-1, because the last step is always a pass
  const steps: DraftStep[] = new Array(cards).fill(DEFAULT_STEPS).flat();
  //use normalize
  steps.pop();
  return steps;
};

export const createDefaultDraftFormat = (packsPerPlayer: number, cardsPerPack: number): DraftFormat => {
  return {
    title: `Standard Draft`,
    packs: Array.from({ length: packsPerPlayer }, () => ({
      slots: Array.from({ length: cardsPerPack }, () => '*'),
      steps: buildDefaultSteps(cardsPerPack),
    })),
    multiples: false,
    markdown: '',
    defaultSeats: 8,
  };
};

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
