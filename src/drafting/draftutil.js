import { cardCmc, cardType } from 'utils/Card';
import { cmcColumn } from 'utils/Util';

export const setupPicks = (rows, cols) => {
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

export const getCardCol = (draft, cardIndex) => Math.max(0, Math.min(7, cardCmc(draft.cards[cardIndex])));

export const defaultStepsForLength = (length) =>
  new Array(length)
    .fill([
      { action: 'pick', amount: 1 },
      { action: 'pass', amount: 1 },
    ])
    .flat()
    .slice(0, length * 2 - 1) // Remove the final pass.
    .map((action) => ({ ...action }));

const flattenSteps = (steps) => {
  const res = [];
  let pick = 0;
  let cardsInPack = steps.map((step) => (step.action === 'pass' ? 0 : step.amount)).reduce((a, b) => a + b, 0) + 1;

  for (const step of steps) {
    if (step.amount) {
      for (let i = 0; i < step.amount; i++) {
        if (step.action !== 'pass') {
          pick += 1;
          cardsInPack -= 1;

          res.push({ pick, action: step.action, cardsInPack, amount: step.amount - i });
        } else {
          res.push({ pick, action: step.action, cardsInPack: cardsInPack - 1 });
        }
      }
    } else if (step.action !== 'pass') {
      pick += 1;
      cardsInPack -= 1;

      res.push({ pick, action: step.action, cardsInPack, amount: 1 });
    } else {
      res.push({ pick, action: step.action, cardsInPack: cardsInPack - 1 });
    }
  }
  return res;
};

export const getStepList = (initialState) =>
  initialState[0]
    .map((pack, packIndex) => [
      ...flattenSteps(pack.steps || defaultStepsForLength(pack.cards.length)).map((step) => ({
        pack: packIndex + 1,
        ...step,
      })),
      {
        pack: packIndex + 1,
        action: 'endpack',
      },
    ])
    .flat();

export const nextStep = (draft, seat, cardsPicked) => {
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

export const getDrafterState = (draft, seatNumber, pickNumber) => {
  // build list of steps and match to pick and pack number
  const steps = getStepList(draft.InitialState);

  // build a list of states for each seat
  const states = [];
  for (let i = 0; i < draft.seats.length; i++) {
    const picksList = [];
    const pickQueue = draft.seats[i].pickorder.slice().map((val) => parseInt(val, 10));
    const trashQueue = (draft.seats[i].trashorder || []).slice().map((val) => parseInt(val, 10));
    let index = 0;

    for (let j = 0; j < steps.length; j++) {
      const step = steps[j];

      if (!picksList[step.pack - 1]) {
        picksList[step.pack - 1] = [];
      }

      if (step.action === 'pick' || step.action === 'pickrandom') {
        picksList[step.pack - 1].push({ action: step.action, cardIndex: pickQueue.pop(), index });
        index += 1;
      } else if (step.action === 'trash' || step.action === 'trashrandom') {
        picksList[step.pack - 1].push({ action: step.action, cardIndex: trashQueue.pop(), index });
        index += 1;
      }
    }

    states.push({
      picked: [],
      trashed: [],
      pickQueue: draft.seats[i].pickorder.slice(),
      trashQueue: (draft.seats[i].trashorder || []).slice(),
      cardsPicked: [...draft.seats[i].mainboard.flat(3), ...draft.seats[i].sideboard.flat(3)],
      cardsInPack: [],
      picksList,
    });
  }

  // setup some useful context variables
  let packsWithCards = [];
  let offset = 0;

  // go through steps and update states
  for (const step of steps) {
    // open pack if we need to open a new pack
    if (step.pick === 1 && step.action !== 'pass') {
      packsWithCards = [];

      for (let i = 0; i < draft.InitialState.length; i++) {
        packsWithCards[i] = draft.InitialState[i][step.pack - 1].cards.slice();
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

        seat.picked.push(picked);
        seat.selection = picked;
        seat.step = step;

        // remove this card from the pack
        packsWithCards[(i + offset) % states.length] = packsWithCards[(i + offset) % states.length].filter(
          (card) => card !== picked,
        );
      } else if (step.action === 'trash' || step.action === 'trashrandom') {
        seat.cardsInPack = packsWithCards[(i + offset) % states.length].slice();
        const trashed = seat.trashQueue.pop();
        seat.trashed.push(trashed);
        seat.selection = trashed;
        seat.step = step;

        // remove this card from the pack
        packsWithCards[(i + offset) % states.length] = packsWithCards[(i + offset) % states.length].filter(
          (card) => card !== trashed,
        );
      }
    }

    // if we've reached the desired time in the draft, we're done
    if (states[seatNumber].picked.length + states[seatNumber].trashed.length > pickNumber) {
      break;
    }

    // now if it's a pass we can pass
    if (step.action === 'pass') {
      const passLeft = step.pack % 2 === 1;
      offset = (offset + (passLeft ? 1 : states.length - 1)) % states.length;
    }
  }

  return states[seatNumber];
};

export const getDefaultPosition = (card, picks) => {
  const row = cardType(card).toLowerCase().includes('creature') ? 0 : 1;
  const col = cmcColumn(card);
  const colIndex = picks[row][col].length;
  return [row, col, colIndex];
};

export const stepListToTitle = (steps) => {
  if (steps.length <= 1) {
    return 'Finishing up draft...';
  }

  if (steps[0] === 'pick') {
    let count = 1;
    while (steps.length > count && steps[count] === 'pick') {
      count += 1;
    }
    if (count > 1) {
      return `Pick ${count} more cards`;
    }
    return 'Pick one more card';
  }
  if (steps[0] === 'trash') {
    let count = 1;
    while (steps.length > count && steps[count] === 'trash') {
      count += 1;
    }
    if (count > 1) {
      return `Trash ${count} more cards`;
    }
    return 'Trash one more card';
  }
  if (steps[0] === 'endpack') {
    return 'Waiting for next pack to open...';
  }

  return 'Making random selection...';
};

export const draftStateToTitle = (draft, picks, trashed, loading, stepQueue) => {
  let stepText = stepListToTitle(stepQueue);
  // get count of picks
  const totalPicks = picks.reduce((acc, row) => acc + row.reduce((acc2, col) => acc2 + col.length, 0), 0);
  // get count of trashes
  const totalTrashed = trashed.length;

  let pack = 1;
  let pick = 1;

  const steplist = getStepList(draft.InitialState);
  let pickCount = 0;
  let trashCount = 0;

  for (const step of steplist) {
    if (step.action === 'endpack') {
      pack += 1;
      pick = 1;
    } else if (step.action === 'pick' || step.action === 'pickrandom') {
      if (totalPicks <= pickCount && totalTrashed <= trashCount) {
        break;
      }
      pickCount += 1;
      pick += 1;
    } else if (step.action === 'trash' || step.action === 'trashrandom') {
      if (totalPicks <= pickCount && totalTrashed <= trashCount) {
        break;
      }
      trashCount += 1;
      pick += 1;
    }
  }

  if (!stepText.includes('Waiting') && loading) {
    stepText = 'Waiting for cards...';
  }

  if (stepText.includes('Finishing up draft')) {
    return stepText;
  }

  return `Pack ${pack} Pick ${pick}: ${stepText}`;
};
