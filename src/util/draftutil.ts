import { cardCmc, cardType, cmcColumn } from '../client/utils/cardutil';
import Card from '../datatypes/Card';
import Draft, { DraftFormat, DraftStep } from '../datatypes/Draft';

interface Step {
  action: string;
  amount?: number;
  pick?: number;
  cardsInPack?: number;
}

interface FlattenedStep extends Step {
  pack: number;
}

interface DrafterState {
  picked: number[];
  trashed: number[];
  pickQueue: number[];
  trashQueue: number[];
  cardsPicked: number[];
  cardsInPack: number[];
  picksList: {
    cardIndex: number;
    action: string;
    index: number;
  }[][];
  pick?: number;
  pack?: number;
  selection?: number;
  step?: Step;
}

export const flattenSteps = (steps: Step[], pack: number): FlattenedStep[] => {
  const res: FlattenedStep[] = [];
  let pick = 0;
  let cardsInPack = steps.map((step) => (step.action === 'pass' ? 0 : step.amount || 0)).reduce((a, b) => a + b, 0) + 1;

  for (const step of steps) {
    if (step.amount) {
      for (let i = 0; i < step.amount; i++) {
        if (step.action !== 'pass') {
          pick += 1;
          cardsInPack -= 1;

          res.push({
            pick,
            action: step.action,
            cardsInPack,
            amount: step.amount - i,
            pack,
          });
        } else {
          res.push({
            pick,
            action: step.action,
            cardsInPack: cardsInPack - 1,
            pack,
          });
        }
      }
    } else if (step.action !== 'pass') {
      pick += 1;
      cardsInPack -= 1;

      res.push({
        pick,
        action: step.action,
        cardsInPack,
        amount: 1,
        pack,
      });
    } else {
      res.push({
        pick,
        action: step.action,
        cardsInPack: cardsInPack - 1,
        pack,
      });
    }
  }
  return res;
};

export const defaultStepsForLength = (length: number): Step[] =>
  new Array(length)
    .fill([
      { action: 'pick', amount: 1 },
      { action: 'pass', amount: 1 },
    ])
    .flat()
    .slice(0, length * 2 - 1) // Remove the final pass.
    .map((action) => ({ ...action }));

export const getStepList = (initialState: any[]): FlattenedStep[] =>
  initialState[0]
    .map((pack: any, packIndex: number) => [
      ...flattenSteps(pack.steps || defaultStepsForLength(pack.cards.length), packIndex),
      {
        pack: packIndex + 1,
        action: 'endpack',
      },
    ])
    .flat();

export const nextStep = (draft: Draft, cardsPicked: number): string | null => {
  if (!draft.InitialState) {
    return null;
  }

  const steps = getStepList(draft.InitialState);

  let picks = 0;

  for (const step of steps) {
    if (picks >= cardsPicked) {
      return step.action;
    }

    if (step.action !== 'pass' && step.action !== 'endpack') {
      picks += 1;
    }
  }

  return null;
};

export const getDrafterState = (draft: Draft, seatNumber: number, pickNumber: number): DrafterState => {
  if (!draft.InitialState) {
    return {
      picked: [],
      trashed: [],
      pickQueue: [],
      trashQueue: [],
      cardsPicked: [],
      cardsInPack: [],
      picksList: [],
    };
  }

  // build list of steps and match to pick and pack number
  const steps = getStepList(draft.InitialState);

  // build a list of states for each seat
  const states: DrafterState[] = [];
  for (let i = 0; i < draft.seats.length; i++) {
    const picksList: any[] = [];
    const pickQueue = (draft.seats[i].pickorder || []).slice();
    const trashQueue = (draft.seats[i].trashorder || []).slice();
    let index = 0;

    for (let j = 0; j < steps.length; j++) {
      const step = steps[j];

      if (!picksList[step.pack]) {
        picksList[step.pack] = [];
      }

      if (step.action === 'pick' || step.action === 'pickrandom') {
        picksList[step.pack].push({ action: step.action, cardIndex: pickQueue.pop(), index });
        index += 1;
      } else if (step.action === 'trash' || step.action === 'trashrandom') {
        picksList[step.pack].push({ action: step.action, cardIndex: trashQueue.pop(), index });
        index += 1;
      }
    }

    states.push({
      picked: [],
      trashed: [],
      pickQueue: (draft.seats[i].pickorder || []).slice(),
      trashQueue: (draft.seats[i].trashorder || []).slice(),
      cardsPicked: [...draft.seats[i].mainboard.flat(3), ...draft.seats[i].sideboard.flat(3)],
      cardsInPack: [],
      picksList,
    });
  }

  // setup some useful context variables
  let packsWithCards: any[] = [];
  let offset = 0;

  // go through steps and update states
  for (const step of steps) {
    // open pack if we need to open a new pack
    if (step.pick === 1 && step.action !== 'pass') {
      packsWithCards = [];

      for (let i = 0; i < draft.InitialState.length; i++) {
        packsWithCards[i] = draft.InitialState[i][step.pack].cards.slice();
      }

      offset = 0;
    }

    // perform the step if it's not a pass
    for (let i = 0; i < states.length; i++) {
      const seat = states[i];
      seat.pick = step.pick;
      seat.pack = step.pack;

      if (step.action === 'pick' || step.action === 'pickrandom') {
        seat.cardsInPack = packsWithCards[(i + offset) % draft.seats.length].slice();

        let picked = seat.pickQueue.pop();

        if (picked === -1) {
          // try to make picked a card in the pack that exists in cardsPicked
          for (const cardIndex of seat.cardsInPack) {
            if (seat.cardsPicked.includes(cardIndex)) {
              picked = cardIndex;
              break;
            }
          }
        }

        seat.picked.push(picked || -1);
        seat.selection = picked;
        seat.step = step;

        // remove this card from the pack
        packsWithCards[(i + offset) % states.length] = packsWithCards[(i + offset) % states.length].filter(
          (card: number) => card !== picked,
        );
      } else if (step.action === 'trash' || step.action === 'trashrandom') {
        seat.cardsInPack = packsWithCards[(i + offset) % states.length].slice();
        const trashed = seat.trashQueue.pop();
        seat.trashed.push(trashed || -1);
        seat.selection = trashed;
        seat.step = step;

        // remove this card from the pack
        packsWithCards[(i + offset) % states.length] = packsWithCards[(i + offset) % states.length].filter(
          (card: number) => card !== trashed,
        );
      }
    }

    // if we've reached the desired time in the draft, we're done
    if (states[seatNumber].picked.length + states[seatNumber].trashed.length > pickNumber) {
      break;
    }

    // now if it's a pass we can pass
    if (step.action === 'pass') {
      const passLeft = step.pack % 2 === 0;
      offset = (offset + (passLeft ? 1 : states.length - 1)) % states.length;
    }
  }

  return states[seatNumber];
};

export const getDefaultPosition = (card: Card, picks: any[][][]): [number, number, number] => {
  const { row, col } = getCardDefaultRowColumn(card);
  const colIndex = picks[row][col].length;
  return [row, col, colIndex];
};

export const getCardDefaultRowColumn = (card: Card): { row: number; col: number } => {
  const isCreature = cardType(card).toLowerCase().includes('creature');
  //Some cards, like Assault//Battery, have a CMC that is a decimal (and then there are un-cards). cmcColumn normalizes between 0 and 8
  const cmc = cmcColumn(card);

  const row = isCreature ? 0 : 1;
  const col = Math.max(0, Math.min(7, cmc));

  return { row, col };
};

export const stepListToTitle = (steps: DraftStep[]): string => {
  if (steps.length <= 1) {
    return 'Finishing up draft...';
  }

  if (steps[0].action === 'pick') {
    let count = 1;
    while (steps.length > count && steps[count].action === 'pick') {
      count += 1;
    }
    if (count > 1) {
      return `Pick ${count} more cards`;
    }
    return 'Pick one more card';
  }
  if (steps[0].action === 'trash') {
    let count = 1;
    while (steps.length > count && steps[count].action === 'trash') {
      count += 1;
    }
    if (count > 1) {
      return `Trash ${count} more cards`;
    }
    return 'Trash one more card';
  }
  if (steps[0].action === 'endpack') {
    return 'Waiting for next pack to open...';
  }

  return 'Making random selection...';
};

export const getCardCol: (draft: Draft, cardIndex: number) => number = (draft: Draft, cardIndex: number) =>
  Math.max(0, Math.min(7, cardCmc(draft.cards[cardIndex])));

export const setupPicks: (rows: number, cols: number) => any[][][] = (rows: number, cols: number) => {
  const res = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      row.push([]);
    }
    res.push(row);
  }
  return res;
};

export const normalizeDraftFormatSteps = (format: DraftFormat): DraftFormat => {
  for (let packNum = 0; packNum < format.packs.length; packNum++) {
    const steps = format.packs[packNum].steps;

    //Nothing to do for null steps. Null represents default steps
    if (steps === null) {
      continue;
    }

    format.packs[packNum].steps = normalizeDraftSteps(steps);
  }

  return format;
};

export const normalizeDraftSteps = (steps: DraftStep[]): DraftStep[] => {
  const stepsLength = steps.length;
  const lastStep = steps[stepsLength - 1];
  if (lastStep.action === 'pass') {
    steps.pop();
  }

  return steps;
};
