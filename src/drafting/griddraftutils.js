export const getGridDrafterState = ({ gridDraft, seatNumber }) => {
  const { cards, initial_state } = gridDraft;
  const numPacks = gridDraft.initial_state.length;
  const seatNum = parseInt(seatNumber, 10);
  let curStep = 0;
  const seen = [];
  const pickedIndices = [gridDraft.seats[0].pickedIndices, gridDraft.seats[1].pickedIndices];
  let curPickNum = 0;
  const pickedNums = [0, 0];
  let currentPicker = 0;
  let cardsInPack = initial_state[0];
  let packNum = 0;

  if (currentPicker === seatNum) {
    seen.push(...cardsInPack);
  }

  while (packNum < numPacks && pickedIndices[currentPicker].length > pickedNums[currentPicker]) {
    cardsInPack = initial_state[packNum].slice();
    cardsInPack[pickedIndices[currentPicker][pickedNums[currentPicker]]] = null;
    cardsInPack[pickedIndices[currentPicker][pickedNums[currentPicker] + 1]] = null;
    cardsInPack[pickedIndices[currentPicker][pickedNums[currentPicker] + 2]] = null;
    pickedNums[currentPicker] += 3;

    currentPicker = (currentPicker + 1) % 2;
    curStep += 1;

    if (currentPicker === seatNum) {
      curPickNum += 1;
      seen.push(...cardsInPack.filter((x) => x || x === 0));
    }

    if (pickedIndices[currentPicker].length > pickedNums[currentPicker]) {
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
  console.log(cardsInPack);

  return {
    // Note this currently includes all cards. Having this just include cards from open
    // packs would prevent cheating.
    cards,
    picked: gridDraft.seats[seatNum].pickorder.slice(0, pickedNums[seatNum]),
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
    turn: currentPicker === seatNum && packNum < numPacks,
  };
};

export default { getGridDrafterState };
