import seedrandom from 'seedrandom';

import { moveOrAddCard } from 'drafting/DraftLocation';
import { calculateBotPick } from 'drafting/draftbots';
import { cardType } from 'utils/Card';
import { cmcColumn, toNullableInt } from 'utils/Util';

export const defaultStepsForLength = (length) =>
  new Array(length)
    .fill([
      { action: 'pick', amount: 1 },
      { action: 'pass', amount: 1 },
    ])
    .flat()
    .slice(0, length * 2 - 1) // Remove the final pass.
    .map((action) => ({ ...action }));

export const getDrafterState = ({ draft, seatNumber, pickNumber = -1, stepNumber = null }, skipAutoPass = false) => {
  const { cards, basics } = draft;
  const numSeats = draft.initial_state.length;
  const seatNum = parseInt(seatNumber, 10);
  const ourPacks = draft.initial_state[seatNum];
  const numPacks = ourPacks.length;
  const ourSeat = draft.seats[seatNum];
  const stepEnd = toNullableInt(stepNumber);
  const useFinal = stepNumber || pickNumber >= 0;
  const pickEnd = pickNumber === -1 ? ourSeat.pickorder.length + ourSeat.trashorder.length : parseInt(pickNumber, 10);
  const seen = [];
  let pickedNum = 0;
  let trashedNum = 0;
  let curStepNumber = 0;
  let pickNum = 0;
  let packSize = 0;
  let packsWithCards = new Array(draft.initial_state.length).fill([]);
  let action = 'pass';
  let amount = 0;
  let packNum = 0;
  let offset = 0;

  // loop through each pack
  while (packNum < numPacks) {
    const curPackNum = packNum;

    let done = false;
    packsWithCards = draft.initial_state.map((packsForSeat) => packsForSeat[curPackNum].cards.slice());
    pickNum = 0;
    packSize = packsWithCards[seatNum].length;
    offset = 0;
    const steps = ourPacks[curPackNum].steps ?? defaultStepsForLength(ourPacks[curPackNum].cards.length);
    seen.push(...packsWithCards[seatNum]); // We see the pack we opened.

    // loop through each step of this pack
    for ({ action, amount } of steps) {
      const passLeft = (curPackNum % 2 === 0) === (amount || 1) >= 0;

      // repeat the action for the amount
      amount = Math.abs(amount ?? 1);
      while (amount > 0) {
        amount -= 1;

        // if we've reached the end of this step
        if (curStepNumber > (stepEnd ?? curStepNumber + 1)) {
          done = true;
          break;
        }

        // pass if we have a pass
        if (action === 'pass') {
          offset = (offset + (passLeft ? 1 : numSeats - 1)) % numSeats;
          seen.push(...packsWithCards[(seatNum + offset) % numSeats]);

          // pick or trash if we have a pick or trash
        } else if (action.match(/pick|trash/)) {
          // if we've hit the goal state in the middle of an action, end early
          if (pickedNum + trashedNum >= pickEnd) {
            done = true;
            break;
          }

          // simulate the action
          for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
            const offsetSeatIndex = (seatIndex + offset) % numSeats;
            const takenCardIndex = action.match(/pick/)
              ? draft.seats[seatIndex].pickorder[pickedNum]
              : draft.seats[seatIndex].trashorder[trashedNum];

            const cardsInPackForSeat = packsWithCards[offsetSeatIndex];
            const indexToRemove = cardsInPackForSeat.indexOf(takenCardIndex);

            if (indexToRemove < 0) {
              console.error(
                `Seat ${seatIndex} should have picked/trashed ${takenCardIndex} at pickNumber ${
                  pickedNum + trashedNum
                }, but the pack contains only [${packsWithCards[offsetSeatIndex].join(', ')}].`,
              );
            } else {
              packsWithCards[offsetSeatIndex].splice(indexToRemove, 1);
            }
          }

          // increment corresponding counter
          if (action.match(/pick/)) {
            pickedNum += 1;
          } else {
            trashedNum += 1;
          }

          pickNum += 1;
        }
        curStepNumber += 1;
      } // step amount
      if (done) {
        break;
      }
    } // step
    if (done || (useFinal && (curStepNumber > (stepEnd ?? curStepNumber + 1) || pickedNum + trashedNum >= pickEnd))) {
      if (!skipAutoPass && packsWithCards[seatNum].length === 0 && packNum + 1 < numPacks) {
        packsWithCards = draft.initial_state.map((packsForSeat) => packsForSeat[curPackNum + 1].cards.slice());
        seen.push(...packsWithCards[seatNum]); // We see the pack we opened.
      }
      break;
    }
    packNum += 1;
  } // pack

  const result = {
    cards, // .map((card, cardIndex) => (seen.includes(cardIndex) || basics.includes(cardIndex) ? card : null)),
    picked: ourSeat.pickorder.slice(0, pickedNum),
    trashed: ourSeat.trashorder.slice(0, trashedNum),
    seen,
    cardsInPack: packsWithCards[(seatNum + offset) % numSeats],
    basics,
    packNum,
    pickNum,
    numPacks,
    packSize,
    pickedNum,
    trashedNum,
    stepNumber: curStepNumber,
    pickNumber: pickedNum + trashedNum,
    step: { action, amount },
  };
  return result;
};

export const getDefaultPosition = (card, picks) => {
  const row = cardType(card).toLowerCase().includes('creature') ? 0 : 1;
  const col = cmcColumn(card);
  const colIndex = picks[row][col].length;
  return [row, col, colIndex];
};

export const allBotsDraft = (draft) => {
  let drafterStates = draft.seats.map((_, seatNumber) => getDrafterState({ draft, seatNumber }));
  let [
    {
      numPacks,
      packNum,
      step: { action },
    },
  ] = drafterStates;
  const rng = seedrandom(draft.seed);
  while (numPacks > packNum) {
    const currentDraft = draft;
    let picks;
    if (action.match(/random/)) {
      picks = drafterStates.map(({ cardsInPack }) => cardsInPack[Math.floor(rng() * cardsInPack.length)]);
    }
    if (action.match(/pick/)) {
      if (!action.match(/random/)) {
        picks = drafterStates.map((drafterState) => calculateBotPick(drafterState, false));
      }
      draft = {
        ...draft,
        seats: draft.seats.map(({ pickorder, drafted, ...seat }, seatIndex) => ({
          ...seat,
          pickorder: [...pickorder, picks[seatIndex]],
          drafted: moveOrAddCard(
            drafted,
            getDefaultPosition(currentDraft.cards[picks[seatIndex]], drafted),
            picks[seatIndex],
          ),
        })),
      };
    } else if (action.match(/trash/)) {
      if (!action.match(/random/)) {
        picks = drafterStates.map((drafterState) => calculateBotPick(drafterState, true));
      }
      draft = {
        ...draft,
        seats: draft.seats.map(({ trashorder, ...seat }, seatIndex) => ({
          ...seat,
          trashorder: [...trashorder, picks[seatIndex]],
        })),
      };
    } else {
      const errorStr = `Unrecognized action '${action}' in allBotsDraft`;
      console.warn(errorStr);
      throw new Error(errorStr);
    }
    const constDraft = draft;
    drafterStates = draft.seats.map((_, seatNumber) => getDrafterState({ draft: constDraft, seatNumber }));
    [
      {
        numPacks,
        packNum,
        step: { action },
      },
    ] = drafterStates;
  }

  return draft;
};
