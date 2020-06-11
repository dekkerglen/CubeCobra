import { arrayIsSubset } from 'utils/Util';
import similarity from 'compute-cosine-similarity';
import { COLOR_COMBINATIONS, cardColorIdentity, cardName, cardType } from 'utils/Card';

// We want to discourage playing more colors so they get less
// value the more colors, this gets offset by having more cards.
const COLOR_SCALING_FACTOR = [1, 1, 0.7, 0.45, 0.2, 0.1];
const COLORS_WEIGHTS = [
  [0, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5],
  [3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
];
const RATING_WEIGHTS = [
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
];
const FIXING_WEIGHTS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
];
const SYNERGY_WEIGHTS = [
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
];
const OPENNESS_WEIGHTS = [
  [2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.7, 2.6, 2.4, 2.3, 2.2, 2.1],
  [3, 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.7, 3.6, 3.4, 3.2, 3, 2.8, 2.6],
  [2.5, 2.4, 2.3, 2.2, 2.1, 2, 1.8, 1.6, 1.4, 1.2, 1, 0.8, 0.6, 0.3, 0],
];

const findBestValueArray = (weights, pickNumPercent) => {
  const index = weights.length * pickNumPercent;
  const ceilIndex = Math.ceil(index);
  const floorIndex = Math.floor(index);
  // Is an integer or is past the end by less than 1
  if (index === floorIndex || ceilIndex === weights.length) {
    return weights[floorIndex];
  }
  // The fractional part of index.
  const indexModOne = index - floorIndex;
  // If is fractional and not past the end we weight it by the two
  // closest points by how close it is to that point.
  return indexModOne * weights[ceilIndex] + (1 - indexModOne) * weights[floorIndex];
};

const findBestValue2d = (weights, packNum, pickNum, initialState) => {
  const packNumPercent = (packNum - 1) / initialState[0].length;
  const pickNumPercent = (pickNum - 1) / initialState[0][packNum - 1].length;
  const index = weights.length * packNumPercent;
  const ceilIndex = Math.ceil(index);
  const floorIndex = Math.floor(index);
  // Is either an integer or is past the end by less than 1 so we can use floor as our index
  if (index === floorIndex || ceilIndex === weights.length) {
    return findBestValueArray(weights[floorIndex], pickNumPercent);
  }
  // The fractional part of index.
  const indexModOne = index - floorIndex;
  // If is fractional and not past the end we weight it by the two
  // closest points by how close it is to that point.
  return (
    indexModOne * findBestValueArray(weights[ceilIndex], pickNumPercent) +
    (1 - indexModOne) * findBestValueArray(weights[floorIndex], pickNumPercent)
  );
};

export const fetchLands = {
  'Arid Mesa': ['W', 'R'],
  'Bloodstained Mire': ['B', 'R'],
  'Flooded Strand': ['W', 'U'],
  'Marsh Flats': ['W', 'B'],
  'Misty Rainforest': ['U', 'G'],
  'Polluted Delta': ['U', 'B'],
  'Scalding Tarn': ['U', 'R'],
  'Verdant Catacombs': ['B', 'G'],
  'Windswept Heath': ['W', 'G'],
  'Wooded Foothills': ['R', 'G'],
  'Prismatic Vista': ['W', 'U', 'B', 'R', 'G'],
  'Fabled Passage': ['W', 'U', 'B', 'R', 'G'],
};

export const getRating = (combination, card) => {
  return Math.log(COLOR_SCALING_FACTOR[combination.length] * 10 ** ((card?.rating ?? 0) / 400));
};

export const considerInCombination = (combination, card) =>
  card && arrayIsSubset(cardColorIdentity(card) ?? [], combination);

export const getSynergy = (combination, card, picked, synergies) => {
  if (picked.cards.length === 0 || !synergies) {
    return 0;
  }

  let synergy = 0.000001;
  let internalSynergy = 0.000001;
  if (synergies) {
    const pickedInCombo = picked.cards.filter((card2) => considerInCombination(combination, card2));
    let count = 0;
    for (let i = 1; i < pickedInCombo.length; i++) {
      for (let j = 0; j < i; j++) {
        internalSynergy += similarity(synergies[pickedInCombo[i].index], synergies[pickedInCombo[j].index]) ** 10;
        count += 1;
      }
    }
    if (count) {
      internalSynergy /= count;
    }
    if (card) {
      for (const { index } of pickedInCombo) {
        synergy += similarity(synergies[index], synergies[card.index]) ** 10;
      }
      if (pickedInCombo.length) {
        synergy /= pickedInCombo.length;
      }
    }
  }
  return Math.log(internalSynergy + synergy) + 13;
};

export const getOpenness = (combination, seen) => {
  if (seen.cards.length === 0) {
    return 0;
  }

  const seenCount = COLOR_SCALING_FACTOR[combination.length] * seen[combination.join('')];
  return Math.log(seenCount);
};

export const getColor = (combination, picked, card) => {
  return Math.log(
    COLOR_SCALING_FACTOR[combination.length] * (picked[combination.join('')] + 10 ** ((card?.rating ?? 0) / 400)),
  );
};

const basics = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

export const getFixing = (combination, _, card) => {
  const colors = fetchLands[card.details.name] ?? cardColorIdentity(card);
  const typeLine = cardType(card);
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = !!fetchLands[cardName(card)];

  // Guaranteed contains by botRatingAndCombination
  if (isLand || isFetch) {
    let score = 1 / COLOR_SCALING_FACTOR[combination.length];

    const hasBasicTypes = basics.filter((basic) => typeLine.toLowerCase().includes(basic.toLowerCase())).length > 1;
    if (hasBasicTypes) {
      score *= 1.5;
    }
    if (isFetch) {
      score *= 2;
    }

    switch (colors.length) {
      case 0:
        return 0;
      case 1:
        break;
      case 2:
        score *= 2;
        break;
      default:
        score *= Math.min(colors.length, combination.length);
        break;
    }
    return score;
  }
  return 0;
};

export const getRatingWeight = (pack, pick, initialState) => {
  return findBestValue2d(RATING_WEIGHTS, pack, pick, initialState);
};

export const getSynergyWeight = (pack, pick, initialState) => {
  return findBestValue2d(SYNERGY_WEIGHTS, pack, pick, initialState);
};

export const getOpennessWeight = (pack, pick, initialState) => {
  return findBestValue2d(OPENNESS_WEIGHTS, pack, pick, initialState);
};

export const getColorWeight = (pack, pick, initialState) => {
  return findBestValue2d(COLORS_WEIGHTS, pack, pick, initialState);
};

export const getFixingWeight = (pack, pick, initialState) => {
  return findBestValue2d(FIXING_WEIGHTS, pack, pick, initialState);
};
// inPack is the number of cards in this pack
export const botRatingAndCombination = (card, picked, seen, synergies, initialState, inPack = 1, packNum = 1) => {
  // Find the color combination that gives us the highest score1
  // that'll be the color combination we want to play currently.
  const pickNum = initialState?.[0]?.[packNum - 1]?.length - inPack + 1;
  let bestRating = -1;
  let bestCombination = [];
  for (const combination of COLOR_COMBINATIONS) {
    let rating = 0;
    if (card && considerInCombination(combination, card)) {
      rating =
        getRating(combination, card, initialState) * getRatingWeight(packNum, pickNum, initialState) +
        getSynergy(combination, card, picked, synergies) * getSynergyWeight(packNum, pickNum, initialState) +
        getOpenness(combination, seen) * getOpennessWeight(packNum, pickNum, initialState) +
        getColor(combination, picked, card) * getColorWeight(packNum, pickNum, initialState) +
        getFixing(combination, picked, card) * getFixingWeight(packNum, pickNum, initialState);
    } else if (!card) {
      rating = Math.log(COLOR_SCALING_FACTOR[combination.length] * picked[combination.join('')]);
    }
    if (rating > bestRating) {
      bestRating = rating;
      bestCombination = combination;
    }
  }
  return [bestRating, bestCombination];
};

export default {
  getRating,
  getColor,
  getSynergy,
  getOpenness,
  getFixing,
  getRatingWeight,
  getSynergyWeight,
  getOpennessWeight,
  getColorWeight,
  getFixingWeight,
  botRatingAndCombination,
  considerInCombination,
};
