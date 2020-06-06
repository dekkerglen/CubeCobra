// We want to discourage playing more colors so they get less
// value the more colors, this gets offset by having more cards.
const COLOR_SCALING_FACTOR = [1, 1, 0.6, 0.3, 0.1, 0.07];
const COLORS_WEIGHTS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
const VALUE_WEIGHTS = [
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
];
const INTERNAL_SYNERGY_WEIGHTS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
const SYNERGY_WEIGHTS = [
  [1 / 12, 1 / 6, 1 / 4, 1 / 3, 5 / 12, 1 / 2, 7 / 12, 2 / 3, 3 / 4, 5 / 6, 11 / 12, 1, 13 / 12, 7 / 6, 5 / 4],
  [4 / 3, 17 / 12, 3 / 2, 19 / 12, 5 / 3, 7 / 4, 11 / 6, 23 / 12, 2, 25 / 12, 13 / 6, 9 / 4, 7 / 3, 29 / 12, 5 / 2],
  [
    31 / 12,
    8 / 3,
    11 / 4,
    17 / 6,
    35 / 12,
    3,
    37 / 12,
    19 / 6,
    39 / 12,
    10 / 3,
    41 / 12,
    7 / 2,
    43 / 12,
    11 / 3,
    15 / 4,
  ],
];
const OPENNESS_WEIGHTS = [
  [2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.7, 2.6, 2.4, 2.3, 2.2, 2.1],
  [3, 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.7, 3.6, 3.4, 3.2, 3, 2.8, 2.6],
  [2.5, 2.4, 2.3, 2.2, 2.1, 2, 1.8, 1.6, 1.4, 1.2, 1, 0.8, 0.6, 0.4, 0],
];
const OVERALL_COUNT_WEIGHTS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
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

const getRating = (botColors, card) => {
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

const getColor = (combination) => {
  return COLOR_SCALING_FACTOR[combination.length];
};

const getColorWeight = (pack, pick, initialState) => {
  return findBestValue2d(COLORS_WEIGHTS, pack, pick, initialState);
};

const getRatingWeight = (pack, pick, initialState) => {
  return findBestValue2d(COLORS_WEIGHTS, pack, pick, initialState);
};

export default {
  getColor,
  getColorWeight,
};
