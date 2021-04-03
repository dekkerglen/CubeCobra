import { toNullableInt } from 'utils/Util';

export const getGridDrafterState = ({ gridDraft, seatNumber, stepNumber = null, pickNumber = null }) => {
  const { cards, initial_state } = gridDraft;
  const numPacks = gridDraft.initial_state.length;
  const seatNum = parseInt(seatNumber, 10);
  const endStep = toNullableInt(stepNumber) ?? -1;
  const useSteps = endStep >= 0;
  const endPick = toNullableInt(pickNumber) ?? -1;
  const usePickNum = endPick >= 0;
  let curStep = 0;
  const seen = [];
  const pickedIndices = [gridDraft.seats[0].pickedIndices, gridDraft.seats[1].pickedIndices];
  let curPickNum = 0;
  const pickedNums = [0, 0];
  let currentPicker = 0;
  let cardsInPack = initial_state[0];
  if (currentPicker === seatNum) seen.push(...cardsInPack);
  let packNum = 0;
  for (
    ;
    packNum < numPacks &&
    pickedIndices[currentPicker].length > pickedNums[currentPicker] &&
    !(useSteps && curStep >= endStep) &&
    !(usePickNum && curPickNum >= endPick);

  ) {
    cardsInPack = initial_state[packNum].slice();
    cardsInPack[pickedIndices[currentPicker][pickedNums[currentPicker]]] = null;
    cardsInPack[pickedIndices[currentPicker][pickedNums[currentPicker] + 1]] = null;
    cardsInPack[pickedIndices[currentPicker][pickedNums[currentPicker] + 2]] = null;
    pickedNums[currentPicker] += 3;
    if (currentPicker === seatNum) curPickNum += 1;
    currentPicker = (currentPicker + 1) % 2;
    curStep += 1;
    if (currentPicker === seatNum) seen.push(...cardsInPack.filter((x) => x || x === 0));
    console.debug(
      'pickedIndices[...].length',
      pickedIndices[currentPicker].length,
      'pickedNums[...]',
      pickedNums[currentPicker],
      'useSteps',
      useSteps,
      'curStep',
      curStep,
      'endStep',
      endStep,
      'usePickNum',
      usePickNum,
      'curPickNum',
      curPickNum,
      'endPick',
      endPick,
      'currentPicker',
      currentPicker,
    );
    if (
      pickedIndices[currentPicker].length > pickedNums[currentPicker] &&
      !(useSteps && curStep >= endStep) &&
      !(usePickNum && curPickNum >= endPick)
    ) {
      // console.debug('Processing second pick from pack', packNum);
      const firstPicked = pickedIndices[currentPicker][pickedNums[currentPicker]];
      const secondPicked = pickedIndices[currentPicker][pickedNums[currentPicker] + 1];
      pickedNums[currentPicker] += 2;
      // This is the second pick plus the difference between the second and first picks.
      const thirdPicked = 2 * secondPicked - firstPicked;
      if (thirdPicked < 9 && cardsInPack[thirdPicked] !== null) {
        pickedNums[currentPicker] += 1;
      }
      if (currentPicker === seatNum) curPickNum += 1;
      curStep += 1;
      packNum += 1;
      if (packNum < numPacks && currentPicker === seatNum) {
        seen.push(...gridDraft.initial_state[packNum]);
        cardsInPack = initial_state[packNum].slice();
      }
    } else {
      // packNum += 1;
      break;
    }
  }
  console.debug('currentPicker', currentPicker, 'packNum', packNum, 'numPacks', numPacks);
  return {
    // Note this currently includes all cards. Having this just include cards from open
    // packs would prevent cheating.
    cards,
    picked: gridDraft.seats[seatNum].pickorder.slice(0, pickedNums[seatNum]),
    trashed: [],
    basics: gridDraft.basics,
    seen,
    cardsInPack,
    packNum,
    pickNum: currentPicker === packNum % 2 ? 0 : 1,
    numPacks,
    packSize: 2,
    pickedNum: pickedNums[seatNum],
    stepNumber: curStep,
    pickNumber: curPickNum,
    step: { action: 'pass', amount: 1 },
    completedAmount: 0,
    turn: currentPicker === seatNum && packNum < numPacks,
  };
};

export default { getGridDrafterState };
