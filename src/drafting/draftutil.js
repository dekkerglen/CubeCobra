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

export const getDrafterState = ({ draft, seatNumber, pickNumber = -1, stepNumber = null }) => {
  const { cards } = draft;
  const numSeats = draft.initial_state.length;
  const seatNum = parseInt(seatNumber, 10);
  const ourPacks = draft.initial_state[seatNum];
  const numPacks = ourPacks.length;
  const ourSeat = draft.seats[seatNum];
  const stepEnd = toNullableInt(stepNumber);
  const useSteps = !!(stepEnd || stepEnd === 0);
  const pickEnd =
    !useSteps && (pickNumber === -1 ? ourSeat.pickorder.length + ourSeat.trashorder.length : parseInt(pickNumber, 10));
  const seen = [];
  let pickedNum = 0;
  let trashedNum = 0;
  let curStepNumber = 0;
  for (let packNum = 0; packNum < numPacks; packNum++) {
    const packsWithCards = draft.initial_state.map((packsForSeat) => [...packsForSeat[packNum].cards]);
    const packSize = packsWithCards[seatNum].length;
    const steps = ourPacks[packNum].steps ?? defaultStepsForLength(ourPacks[packNum].cards.length);
    let offset = 0;
    let pickNum = 0;
    seen.push(...packsWithCards[seatNum]); // We see the pack we opened.
    for (const { action, amount } of steps) {
      const negativeAmount = (amount ?? 1) < 0;
      for (let completedAmount = 0; completedAmount < Math.abs(amount ?? 1); completedAmount++) {
        if (useSteps && curStepNumber >= stepEnd) {
          return {
            cards: cards.map((card, cardIndex) => (seen.includes(cardIndex) ? card : null)),
            picked: ourSeat.pickorder.slice(0, pickedNum),
            trashed: ourSeat.trashorder.slice(0, trashedNum),
            seen,
            cardsInPack: packsWithCards[(seatNum + offset) % numSeats],
            packNum,
            pickNum,
            numPacks,
            packSize,
            pickedNum,
            trashedNum,
            stepNumber: curStepNumber,
            pickNumber: pickedNum + trashedNum,
            step: { action, amount },
            completedAmount,
          };
        }
        if (action === 'pass') {
          // We have to build our own xor here
          const passLeft = packNum % 2 === 0 ? !negativeAmount : negativeAmount;
          // We have to add numSeats - 1 because javascript does not handle negative modulo correctly.
          offset = (offset + (passLeft ? 1 : numSeats - 1)) % numSeats;
          seen.push(...packsWithCards[(seatNum + offset) % numSeats]);
        } else if (action.match(/pick|trash/)) {
          if (!useSteps && pickedNum + trashedNum >= pickEnd) {
            return {
              cards: cards.map((card, cardIndex) => (seen.includes(cardIndex) ? card : null)),
              picked: ourSeat.pickorder.slice(0, pickedNum),
              trashed: ourSeat.trashorder.slice(0, trashedNum),
              seen,
              cardsInPack: packsWithCards[(seatNum + offset) % numSeats],
              packNum,
              pickNum,
              numPacks,
              packSize,
              pickedNum,
              trashedNum,
              stepNumber: curStepNumber,
              pickNumber: pickedNum + trashedNum,
              step: { action, amount },
              completedAmount,
            };
          }

          for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
            const offsetSeatIndex = (seatIndex + offset) % numSeats;
            const takenCardIndex = action.match(/pick/)
              ? draft.seats[seatIndex].pickorder[pickedNum]
              : draft.seats[seatIndex].trashorder[trashedNum];
            if (action.match(/pick/)) {
              console.log(
                'seatIndex',
                seatIndex,
                'pickorder',
                draft.seats[seatIndex].pickorder,
                'pickedNum',
                pickedNum,
              );
            } else {
              console.log(
                'seatIndex',
                seatIndex,
                'trashorder',
                draft.seats[seatIndex].trashorder,
                'trashedNum',
                trashedNum,
              );
            }
            console.log('takenCardIndex', takenCardIndex);
            const cardsInPackForSeat = packsWithCards[offsetSeatIndex];
            console.log('offsetSeatIndex', offsetSeatIndex, 'cardsInPackForSeat', cardsInPackForSeat);
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
          if (action.match(/pick/)) {
            pickedNum += 1;
          } else {
            trashedNum += 1;
          }
          pickNum += 1;
        }
        curStepNumber += 1;
      }
    }
  }
  return {
    cards: cards.map((card, cardIndex) => (seen.includes(cardIndex) ? card : null)),
    picked: ourSeat.pickorder.slice(),
    trashed: ourSeat.trashorder.slice(),
    seen,
    cardsInPack: [],
    packNum: numPacks,
    pickNum: 15,
    numPacks,
    packSize: 15,
    pickedNum: ourSeat.pickorder.length,
    trashedNum: ourSeat.trashorder.length,
    stepNumber: curStepNumber,
    pickNumber: pickedNum + trashedNum,
    step: { action: 'pass', amount: 1 },
    completedAmount: 0,
  };
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
  while (numPacks > packNum) {
    const currentDraft = draft;
    if (action.match(/pick/)) {
      const picks = drafterStates.map((drafterState) => calculateBotPick(drafterState, false));
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
      const picks = drafterStates.map((drafterState) => calculateBotPick(drafterState, true));
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
    const newDraft = draft;
    drafterStates = draft.seats.map((_, seatNumber) => getDrafterState({ newDraft, seatNumber }));
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
