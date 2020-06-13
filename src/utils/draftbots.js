import { arrayIsSubset } from 'utils/Util';
import similarity from 'compute-cosine-similarity';
import { COLOR_COMBINATIONS, cardColorIdentity, cardName, cardType } from 'utils/Card';

// We want to discourage playing more colors so they get less
// value the more colors, this gets offset by having more cards.
const COLOR_SCALING_FACTOR = [1, 1, 0.7, 0.45, 0.2, 0.1];
const COLORS_WEIGHTS = [
  [0, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5],
  [3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5],
  [5, 5.2, 5.4, 5.5, 5.6, 5.8, 6, 6.2, 6.4, 6.5, 6.6, 6.8, 7, 7.2, 7.5],
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
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 7],
];
const OPENNESS_WEIGHTS = [
  [2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.7, 2.6, 2.4, 2.3, 2.2, 2.1],
  [3, 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.7, 3.6, 3.4, 3.2, 3, 2.8, 2.6],
  [2.5, 2.4, 2.3, 2.2, 2.1, 2, 1.8, 1.6, 1.4, 1.2, 1, 0.8, 0.6, 0.3, 0],
];

// These functions get approximate weight values when there are not 15 cards in the pack.
// They treat pack/pick number out of 3/15 as a lattice and just average the surrounding points if the desired weight is off the lattice.
const interpolateWeight1d = (weights, pickNumPercent) => {
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

const interpolateWeight2d = (weights, packNum, pickNum, initialState) => {
  const packNumPercent = (packNum - 1) / initialState[0].length;
  const pickNumPercent = (pickNum - 1) / initialState[0][packNum - 1].length;
  const index = weights.length * packNumPercent;
  const ceilIndex = Math.ceil(index);
  const floorIndex = Math.floor(index);
  // Is either an integer or is past the end by less than 1 so we can use floor as our index
  if (index === floorIndex || ceilIndex === weights.length) {
    return interpolateWeight1d(weights[floorIndex], pickNumPercent);
  }
  // The fractional part of index.
  const indexModOne = index - floorIndex;
  // If is fractional and not past the end we weight it by the two
  // closest points by how close it is to that point.
  return (
    indexModOne * interpolateWeight1d(weights[ceilIndex], pickNumPercent) +
    (1 - indexModOne) * interpolateWeight1d(weights[floorIndex], pickNumPercent)
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
  'Prismatic Vista': [...'WUBRG'],
  'Fabled Passage': [...'WUBRG'],
  'Terramorphic Expanse': [...'WUBRG'],
  'Evolving Wilds': [...'WUBRG'],
};

// What is the raw power level of this card?
// Scale is roughly 0-1, linear. Black Lotus should be ~1.
export const getRating = (combination, card) => {
  return (card?.rating ?? 1200) / 1200 - 1;
};

export const considerInCombination = (combination, card) =>
  card && arrayIsSubset(cardColorIdentity(card) ?? [], combination);

// Ignore synergy below this value.
const SIMILARITY_CLIP = 0.8;
const SIMILARITY_MULTIPLIER = 1 / (1 - SIMILARITY_CLIP);

const scaleSimilarity = (value) => SIMILARITY_MULTIPLIER * Math.max(0, value - SIMILARITY_CLIP);

// Scale to get similarity range to approximately [0, 1]
const SYNERGY_SCALE = 4.2;

// How much do the cards we've already picked in this combo synergize with each other?
// Scale is roughly 0-1.
export const getInternalSynergy = (combination, picked, synergies) => {
  if (picked.cards.length === 0 || !synergies) {
    return 0;
  }

  let internalSynergy = 0;
  if (synergies) {
    const pickedInCombo = picked.cards.filter((card2) => considerInCombination(combination, card2));
    for (let i = 1; i < pickedInCombo.length; i++) {
      for (let j = 0; j < i; j++) {
        const similarityValue = similarity(synergies[pickedInCombo[i].index], synergies[pickedInCombo[j].index]);
        internalSynergy += -Math.log(1 - scaleSimilarity(similarityValue)) / SYNERGY_SCALE;
      }
    }
  }

  const numPairs = (picked.cards.length * (picked.cards.length + 1)) / 2;
  return internalSynergy / numPairs;
};

// How much does the card we're considering synergize with the cards we've picked?
// Scale is roughly 0-1.
export const getPickSynergy = (combination, card, picked, synergies) => {
  if (picked.cards.length === 0 || !synergies) {
    return 0;
  }

  let synergy = 0;
  if (synergies && card) {
    const pickedInCombo = picked.cards.filter((card2) => considerInCombination(combination, card2));
    for (const { index } of pickedInCombo) {
      // Don't count synergy for duplicate cards.
      // Maximum synergy is generally around .997 which corresponds to ~1.
      if (index !== card.index) {
        const similarityValue = similarity(synergies[index], synergies[card.index]);
        synergy += -Math.log(1 - scaleSimilarity(similarityValue)) / SYNERGY_SCALE;
      }
    }
  }
  return synergy / picked.cards.length;
};

// Has this color combination been flowing openly?
// Scale from 0-1.
export const getOpenness = (combination, seen) => {
  if (seen.cards.length === 0) {
    return 0;
  }

  return seen[combination.join('')] / seen.cards.length;
};

// How good are the cards we've already picked in this color combo?
// Scale from 0-1.
export const getColor = (combination, picked) => {
  if (picked.cards.length === 0) {
    return 0;
  }

  return picked[combination.join('')] / picked.cards.length;
};

const basics = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

// Does this help us fix for this combination of colors?
// Scale from 0-1.
export const getFixing = (combination, _, card) => {
  const colors = fetchLands[card.details.name] ?? cardColorIdentity(card);
  const typeLine = cardType(card);
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = !!fetchLands[cardName(card)];

  // Guaranteed contains by botRatingAndCombination
  if (isLand || isFetch) {
    let score = 0.25;

    const hasBasicTypes = basics.filter((basic) => typeLine.toLowerCase().includes(basic.toLowerCase())).length > 1;
    if (hasBasicTypes) {
      score *= 1.5;
    } else if (isFetch) {
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
  return interpolateWeight2d(RATING_WEIGHTS, pack, pick, initialState);
};

export const getSynergyWeight = (pack, pick, initialState) => {
  return interpolateWeight2d(SYNERGY_WEIGHTS, pack, pick, initialState);
};

export const getOpennessWeight = (pack, pick, initialState) => {
  return interpolateWeight2d(OPENNESS_WEIGHTS, pack, pick, initialState);
};

export const getColorWeight = (pack, pick, initialState) => {
  return interpolateWeight2d(COLORS_WEIGHTS, pack, pick, initialState);
};

export const getFixingWeight = (pack, pick, initialState) => {
  return interpolateWeight2d(FIXING_WEIGHTS, pack, pick, initialState);
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
        getPickSynergy(combination, card, picked, synergies) * getSynergyWeight(packNum, pickNum, initialState) +
        getInternalSynergy(combination, picked, synergies) * getSynergyWeight(packNum, pickNum, initialState) +
        getOpenness(combination, seen) * getOpennessWeight(packNum, pickNum, initialState) +
        getColor(combination, picked) * getColorWeight(packNum, pickNum, initialState) +
        getFixing(combination, picked, card) * getFixingWeight(packNum, pickNum, initialState) +
        Math.log(COLOR_SCALING_FACTOR[combination.length]);
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
  getInternalSynergy,
  getPickSynergy,
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
