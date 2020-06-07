import { arrayIsSubset } from 'utils/Util';
import similarity from 'compute-cosine-similarity';
import { COLOR_COMBINATIONS } from 'utils/Card';

// We want to discourage playing more colors so they get less
// value the more colors, this gets offset by having more cards.
const COLOR_SCALING_FACTOR = [1, 1, 0.9, 0.7, 0.5, 0.2];
const COLORS_WEIGHTS = [
  [0, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
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
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  // [0, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3],
  // [2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3, 3, 3, 3],
  // [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
];
const OPENNESS_WEIGHTS = [
  [2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.7, 2.6, 2.4, 2.3, 2.2, 2.1],
  [3, 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.7, 3.6, 3.4, 3.2, 3, 2.8, 2.6],
  [2.5, 2.4, 2.3, 2.2, 2.1, 2, 1.8, 1.6, 1.4, 1.2, 1, 0.8, 0.6, 0.4, 0],
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

export const getAdjustedElo = (botColors, card) => {
  let { rating } = card;
  const colors = fetchLands[card.details.name] ?? card.colors ?? card.details.color_identity;
  const colorless = colors.length === 0;
  const subset = arrayIsSubset(colors, botColors) && !colorless;
  const contains = arrayIsSubset(botColors, colors);
  const overlap = botColors.some((c) => colors.includes(c));
  const typeLine = card.type_line ?? card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = !!fetchLands[card.details.name];

  // If you add x to a rating you roughly increase the estimated value
  // of picking it by a factor of (100 * 10**(x/400)) - 100 percent
  if (isLand) {
    if ((subset || contains) && isFetch) {
      rating += 280; // Increase value of picking by roughly 400%
    } else if (subset || contains) {
      switch (colors.length) {
        case 1:
          rating += 191; // Increase value of picking by roughly 200%
          break;
        case 2:
          rating += 262; // Increase value of picking by roughly 350%
          break;
        default:
          rating += 311; // Increase value of picking by roughly 500%
          break;
      }
    } else if (overlap && isFetch) {
      rating += 241; // Increase value of picking by roughly 300%
    } else if (overlap || colorless) {
      rating += 159; // Increase value of picking by roughly 150%
    }
  } else if (colorless) {
    rating += 205; // Increase value of picking by roughly 225%
  } else if (subset) {
    rating += 191; // Increase value of picking by roughly 200%
  } else if (contains) {
    rating += 141; // Increase value of picking by roughly 125%
  } else if (overlap) {
    rating += 70; // Increase value of picking by roughly 50%
  }

  return rating;
};

export const getRating = (combination, card) => {
  return (COLOR_SCALING_FACTOR[combination.length] * (card.rating - 500 || 1000)) / 100;
};

export const considerInCombination = (combination, card) =>
  card && arrayIsSubset(card.colors ?? card.details.color_identity ?? card.details.colors ?? [], combination);

export const getSynergy = (combination, card, picked, synergies) => {
  if (picked.cards.length === 0) {
    return 0;
  }

  let synergy = 0;
  if (synergies) {
    const pickedInCombo = picked.cards.filter((card2) => considerInCombination(combination, card2));
    if (card) {
      for (const { index } of pickedInCombo) {
        synergy += similarity(synergies[index], synergies[card.index]);
      }
      if (pickedInCombo.length) {
        synergy /= pickedInCombo.length;
      }
    }
  }
  return synergy * 10;
};

export const getOpenness = (combination, seen) => {
  if (seen.cards.length <= 15) {
    return 0;
  }

  const seenCount = seen[combination.join('')] / seen.cards.length;
  // This is technically cheating, but looks at the set of
  // all cards dealt out to players to see what the trends
  // for colors are. This is in value as well.
  // const overallCount = (overallPool[combination.join('')];
  // The ratio of seen to overall gives us an idea what is
  // being taken.
  return seenCount * 3;
};

export const getColor = (combination, picked, card) => {
  return (
    (COLOR_SCALING_FACTOR[combination.length] / 10) * (picked[combination.join('')] + getRating(combination, card))
  );
};

export const getFixing = (combination, picked, card) => {
  let score = card.rating;

  const colors = fetchLands[card.details.name] ?? card.colors ?? card.details.color_identity;
  const colorless = colors.length === 0;
  const subset = arrayIsSubset(colors, combination) && !colorless;
  const contains = arrayIsSubset(combination, colors);
  const overlap = combination.some((c) => colors.includes(c));
  const typeLine = card.type_line ?? card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = !!fetchLands[card.details.name];

  if (isLand) {
    if (colorless && !isFetch) {
      return 0;
    }
    if (colors.length === 1 && !isFetch) {
      return 1;
    }

    score /= COLOR_SCALING_FACTOR[combination.length];

    if ((subset || contains) && isFetch) {
      score *= 1.5;
    } else if (subset || contains) {
      switch (colors.length) {
        case 2:
          score *= 1.5;
          break;
        default:
          score *= 2;
          break;
      }
    } else if (overlap && isFetch) {
      score *= 2;
    } else if (overlap) {
      score *= 1.2;
    }
  } else {
    score *= 0.5 * COLOR_SCALING_FACTOR[combination.length];
  }

  return Math.min(10, score / 1000);
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
      rating = picked[combination.join('')];
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
  getAdjustedElo,
  botRatingAndCombination,
  considerInCombination,
};
