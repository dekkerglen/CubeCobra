import Card from 'datatypes/Card';
import DraftSeat from 'datatypes/DraftSeat';
import User from './User';

export type DraftAction = 'pick' | 'pass' | 'trash' | 'pickrandom' | 'trashrandom';

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
  const steps = new Array(cards).fill(DEFAULT_STEPS).flat();
  steps.pop();
  return steps;
};

export const getErrorsInFormat = (format: DraftFormat) => {
  const errors = [];
  if (!format?.packs) return ['Internal error in the format.'];
  if (!format.title.trim()) errors.push('title must not be empty.');
  if (format.packs.length === 0) errors.push('Format must have at least 1 pack.');

  if (format.defaultSeats !== undefined) {
    if (!Number.isFinite(format.defaultSeats)) errors.push('Default seat count must be a number.');
    if (format.defaultSeats < 2 || format.defaultSeats > 16)
      errors.push('Default seat count must be between 2 and 16.');
  }

  for (let i = 0; i < format.packs.length; i++) {
    const pack = format.packs[i];

    let amount = 0;

    if (!pack.steps) {
      // this is ok, it just means the pack is a default pack
      continue;
    }

    for (const step of pack.steps) {
      if (step === null) {
        continue;
      }

      const { action, amount: stepAmount } = step;

      if (action === 'pass') {
        continue;
      }

      if (stepAmount !== null) {
        amount += stepAmount;
      } else {
        amount++;
      }
    }

    if (amount !== pack.slots.length) {
      errors.push(`Pack ${i + 1} has ${pack.slots.length} slots but has steps to pick or trash ${amount} cards.`);
    }
  }
  return errors.length === 0 ? null : errors;
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

export default interface Draft {
  seats: DraftSeat[];
  cards: Card[];
  cube: string;
  InitialState: DraftState;
  basics: number[];
  id: string;
  seed: string;
  // g: grid, d: draft, u: upload, s: sealed
  type: 'g' | 'd' | 'u' | 's';
  owner: string | User;
  cubeOwner: string | User;
  date: Date;
  name: string;
}
