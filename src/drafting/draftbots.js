// Exports
// MAX_SCORE : number
// FETCH_LANDS : { [str]: [Color] }
// COLORS : [Color]
// BASICS : [str]
// ORACLES : [Oracle]
// ORACLES_BY_NAME : { [string]: Oracle }
// getSynergy : (int, int, [Card]) -> number
// considerInCombination : ([Color], Card) -> bool
// isPlayableLand : ([Color], Card) -> bool
// getCastingProbability : (Card, { [ColorCombination]: int }) -> number
// getProbability : (int, [Card], { [str]: number }) -> number
// evaluteCard : (int, DrafterState) -> BotScore & {
//   colors : [Color],
//   lands : { [ColorCombination]: int },
//   probability : number,
//   probabilities : { [str]: number },
// }
// getDrafterState : (Draft, int, int?) -> DrafterState
import {
  COLOR_COMBINATIONS,
  COLOR_INCLUSION_MAP,
  cardCmc,
  cardColorIdentity,
  cardCost,
  cardElo,
  cardIsSpecialZoneType,
  cardName,
  cardType,
} from 'utils/Card';
import { arraysAreEqualSets, fromEntries } from 'utils/Util';
import probTableBase64 from 'res/probTable.b64';

const probTable = (() => {
  const isBrowser = typeof window !== 'undefined' && typeof window.atob === 'function';
  const probTableBinary = isBrowser
    ? window.atob(probTableBase64)
    : Buffer.from(probTableBase64, 'base64').toString('binary');

  const probTableUint8 = Uint8Array.from(probTableBinary, (c) => c.charCodeAt(0));

  return new Float32Array(probTableUint8.buffer);
})();

// Maximum value each oracle can achieve.
export const MAX_SCORE = 10;
export const FETCH_LANDS = Object.freeze({
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
});
const COLOR_COMBINATION_INDICES = fromEntries(COLOR_COMBINATIONS.map((comb, i) => [comb.join(''), i]));
const COLOR_COMBINATION_INCLUDES = new Uint8Array(32 * 32);
for (const [comb1, i] of Object.entries(COLOR_COMBINATION_INDICES)) {
  for (const [comb2, j] of Object.entries(COLOR_COMBINATION_INDICES)) {
    COLOR_COMBINATION_INCLUDES[i * 32 + j] = COLOR_INCLUSION_MAP[comb1][comb2] ? 255 : 0;
  }
}
const COLOR_COMBINATION_INTERSECTS = new Uint8Array(32 * 32);
for (const [comb1, i] of Object.entries(COLOR_COMBINATION_INDICES)) {
  for (const [comb2, j] of Object.entries(COLOR_COMBINATION_INDICES)) {
    COLOR_COMBINATION_INTERSECTS[i * 32 + j] = [...comb1].some((c) => [...comb2].includes(c)) ? 255 : 0;
  }
}
export const COLORS = Object.freeze([...'WUBRG']);
export const BASICS = Object.freeze(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']);

// This function gets approximate weight values when there are not 15 cards in the pack.
// It treat pack/pick number out of 3/15 as a lattice and just average the surrounding points
// weighted by distance if the desired point is off the lattice.
const interpolateWeight = (weights, coordMaxPair, ...coordinates) => {
  if (!weights.length) {
    if (weights.length === 0) {
      return 0;
    }
    return weights;
  }
  const [coordinate, maxCoordinate] = coordMaxPair;
  const coordPercent = coordinate / maxCoordinate;
  const index = weights.length * coordPercent;
  const ceilIndex = Math.ceil(index);
  const floorIndex = Math.floor(index);
  // Is either an integer or is past the end by less than 1 so we can use floor as our index
  if (index === floorIndex || ceilIndex === weights.length) {
    return interpolateWeight(weights[Math.min(floorIndex, weights.length - 1)], ...coordinates);
  }
  // Ceil must be at most weights.length - 1 and floor must be ceil - 1 and at least 0
  // so the indexes below must be valid.
  // The fractional part of index.
  const indexModOne = index - floorIndex;
  // If is fractional and not past the end we weight it by the two
  // closest points by how close it is to that point.
  return (
    indexModOne * interpolateWeight(weights[ceilIndex], ...coordinates) +
    (1 - indexModOne) * interpolateWeight(weights[floorIndex], ...coordinates)
  );
};

const synergyCache = {};
export const getSynergy = (index1, index2, cards) => {
  const card1 = cards[index1];
  const card2 = cards[index2];
  const name1 = cardName(card1);
  const name2 = cardName(card2);
  let synergy = synergyCache[name1]?.[name2];
  if ((synergy ?? null) === null) {
    if (!synergyCache[name1]) synergyCache[name1] = {};
    if (!synergyCache[name2]) synergyCache[name2] = {};
    const embedding1 = card1.details.embedding;
    const embedding2 = card2.details.embedding;
    synergy = 0;
    for (let i = 0; i < 64; i++) {
      synergy += embedding1[i] * embedding2[i];
    }
    synergy *= MAX_SCORE;
    synergyCache[name1][name2] = synergy;
    synergyCache[name2][name1] = synergy;
  }
  return synergy;
};

export const considerInCombination = (combination, card) =>
  card && COLOR_INCLUSION_MAP[combination.join('')][(cardColorIdentity(card) ?? []).join('')];

const BASICS_MAP = { w: 'Plains', u: 'Island', b: 'Swamp', r: 'Mountain', g: 'Forest' };
export const isPlayableLand = (colors, card) =>
  considerInCombination(colors, card) ||
  colors.filter((c) => cardColorIdentity(card).includes(c)).length > 1 ||
  (FETCH_LANDS[cardName(card)] && FETCH_LANDS[cardName(card)].some((c) => colors.includes(c))) ||
  colors.some((color) => cardType(card).toLowerCase().includes(BASICS_MAP[color.toLowerCase()].toLowerCase()));

const getMaskedSum = (x, m) => {
  const x32 = new Uint32Array(x.buffer);
  const m32 = new Uint32Array(m.buffer, m.byteOffset, 8);
  const t32 = new Uint32Array(1);
  t32[0] += x32[0] & m32[0]; // eslint-disable-line
  t32[0] += x32[1] & m32[1]; // eslint-disable-line
  t32[0] += x32[2] & m32[2]; // eslint-disable-line
  t32[0] += x32[3] & m32[3]; // eslint-disable-line
  t32[0] += x32[4] & m32[4]; // eslint-disable-line
  t32[0] += x32[5] & m32[5]; // eslint-disable-line
  t32[0] += x32[6] & m32[6]; // eslint-disable-line
  t32[0] += x32[7] & m32[7]; // eslint-disable-line
  const t8 = new Uint8Array(t32.buffer, 0, 4);
  return t8[0] + t8[1] + t8[2] + t8[3];
};

const LANDS_DIMS = 18;
const REQUIRED_A_DIMS = 8;
const REQUIRED_B_DIMS = 4;
const MAX_CMC = 7;

// TODO: Use learnings from draftbot optimization to make this much faster.
const devotionsCache = {};
export const getCastingProbability = (card, lands) => {
  const name = cardName(card);
  let colors = devotionsCache[name];
  if ((colors ?? null) === null) {
    colors = [];
    const cost = cardCost(card);
    if (!cardType(card).toLowerCase().includes('land') && !cardIsSpecialZoneType(card) && cost?.length) {
      const colorSymbols = {};
      for (const symbol of cost) {
        const symbolUpper = symbol.toUpperCase();
        if (!symbolUpper.includes('P') && !symbolUpper.includes('2')) {
          const unsortedSymbolColors = [...COLORS].filter((char) => symbolUpper.includes(char));
          if (unsortedSymbolColors.length > 0) {
            const symbolColors = COLOR_COMBINATIONS.find((comb) => arraysAreEqualSets(unsortedSymbolColors, comb)).join(
              '',
            );
            colorSymbols[symbolColors] = (colorSymbols[symbolColors] ?? 0) + 1;
          }
        }
      }
      colors = Object.entries(colorSymbols);
      if (colors.length > 2) {
        const cmc = Math.min(cardCmc(card), MAX_CMC);
        const countAll = Math.min(
          REQUIRED_A_DIMS - 1,
          colors.reduce((acc, [, count]) => acc + count, 0),
        );
        colors = colors.map(([combination, count]) => [
          new Uint8Array(COLOR_COMBINATION_INTERSECTS.buffer, COLOR_COMBINATION_INDICES[combination] * 32, 32),
          LANDS_DIMS *
            LANDS_DIMS *
            LANDS_DIMS *
            REQUIRED_B_DIMS *
            (Math.min(count, REQUIRED_A_DIMS - 1) + REQUIRED_A_DIMS * cmc),
        ]);
        const maskAll = new Uint8Array(32);
        for (const [arr] of colors) {
          for (let i = 0; i < 32; i++) {
            maskAll[i] |= arr[i]; // eslint-disable-line
          }
        }
        colors.push([
          maskAll,
          LANDS_DIMS * LANDS_DIMS * LANDS_DIMS * REQUIRED_B_DIMS * (countAll + REQUIRED_A_DIMS * cmc),
        ]);
      }
      if (colors.length === 2) {
        if (colors[0][1] > colors[1][1]) {
          [colors[1], colors[0]] = colors;
        }
        const offset =
          LANDS_DIMS *
          LANDS_DIMS *
          LANDS_DIMS *
          (Math.min(REQUIRED_B_DIMS - 1, colors[1][1]) +
            REQUIRED_B_DIMS *
              (Math.min(REQUIRED_A_DIMS - 1, colors[0][1]) + REQUIRED_A_DIMS * Math.min(MAX_CMC, cardCmc(card))));
        const maskA = new Uint8Array(
          COLOR_COMBINATION_INTERSECTS.buffer,
          COLOR_COMBINATION_INDICES[colors[0][0]] * 32,
          32,
        );
        const maskB = new Uint8Array(
          COLOR_COMBINATION_INTERSECTS.buffer,
          COLOR_COMBINATION_INDICES[colors[1][0]] * 32,
          32,
        );
        const c0 = new Uint8Array(32);
        const c1 = new Uint8Array(32);
        const c2 = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          c0[i] = maskA[i] & ~maskB[i]; // eslint-disable-line
          c1[i] = ~maskA[i] & maskB[i]; // eslint-disable-line
          c2[i] = maskA[i] & maskB[i]; // eslint-disable-line
        }
        colors = [[c0, c1, c2], offset];
      }
      if (colors.length === 1) {
        colors = [
          [
            new Uint8Array(COLOR_COMBINATION_INTERSECTS.buffer, COLOR_COMBINATION_INDICES[colors[0][0]] * 32, 32),
            LANDS_DIMS *
              LANDS_DIMS *
              LANDS_DIMS *
              REQUIRED_B_DIMS *
              (Math.min(colors[0][1], REQUIRED_A_DIMS - 1) + REQUIRED_A_DIMS * Math.min(cardCmc(card), MAX_CMC)),
          ],
        ];
      }
    }
    devotionsCache[name] = colors;
  }
  if (colors.length === 2) {
    const [[maskA, maskB, maskAB], offset] = colors;
    const landCountA = getMaskedSum(lands, maskA);
    const landCountB = getMaskedSum(lands, maskB);
    const landCountAB = getMaskedSum(lands, maskAB);
    return probTable[offset + landCountA + LANDS_DIMS * (landCountB + LANDS_DIMS * landCountAB)];
  }
  // This is a really poor approximation, it probably underestimates,
  // but could easily overestimate as well.
  const result = colors.reduce((acc, [mask, offset]) => {
    const landCount = getMaskedSum(lands, mask);
    const prob = probTable[offset + landCount];
    return acc * prob;
  }, 1);
  return result;
};

const sum = (arr) => arr.reduce((acc, x) => acc + x, 0);
const fst = (arr, end) => arr.slice(0, end);

const eloToValue = (elo) => Math.sqrt(10 ** (((elo ?? 1200) - 1200) / 800));

const sumWeightedRatings = (idxs, cards, p, countLands = false) => {
  idxs = idxs.filter((ci) => !cardType(cards[ci]).toLowerCase().includes('land') || countLands);
  if (idxs.length === 0) return 0;
  return idxs.length > 0
    ? sum(idxs.map((ci) => Math.min(MAX_SCORE, p[ci] * eloToValue(cardElo(cards[ci]))))) / idxs.length
    : 0;
};

const sumSynergy = (cardIndex, idxs, cards, probabilities) =>
  probabilities[cardIndex] * sum(idxs.map((ci) => probabilities[ci] * getSynergy(cardIndex, ci, cards)));

const calculateWeight = (weights, { packNum, pickNum, numPacks, packSize }) =>
  interpolateWeight(weights, [packNum, numPacks], [pickNum, packSize]);

export const ORACLES = Object.freeze(
  [
    {
      title: 'Rating',
      tooltip: 'The rating based on the Elo and current color commitments.',
      perConsideredCard: true,
      weights: [
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
        [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      ],
      // What is the raw power level of this card? Used to assess how much we want to play this card.
      computeValue: ({ cardIndices, cards, probabilities }) =>
        sumWeightedRatings(cardIndices, cards, probabilities, true),
    },
    {
      title: 'Pick Synergy',
      tooltip: 'A score of how well this card synergizes with the current picks.',
      perConsideredCard: true,
      weights: [
        [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      ],
      // How much does the card we're considering synergize with the cards we've picked?
      // Helps us assess how much we want to play this card.
      computeValue: ({ picked, cardIndices, cards, sqrtProbabilities: p, basics }) =>
        picked.length + basics.length > 0
          ? cardIndices.reduce((acc, ci) => sumSynergy(ci, picked.concat(basics), cards, p) + acc, 0) /
            (picked.length + basics.length)
          : 0,
    },
    {
      title: 'Internal Synergy',
      tooltip: 'A score of how well current picks in these colors synergize with each other.',
      perConsideredCard: false,
      weights: [
        [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      ],
      // How much do the cards we've already picked in this combo synergize with each other?
      // Helps us assess what colors we want to play.
      // Tends to recommend sticking with colors we've been picking.
      computeValue: ({ picked, cards, sqrtProbabilities: p, totalProbability: total, basics }) =>
        // The weighted sum of each pair's synergy divided by the total number of pairs is quadratic
        // in the ratio of playable cards. Then that ratio would be the dominant factor, dwarfing
        // the synergy values, which undermines our goal. Instead we can treat it as the weighted
        // average over the Pick Synergy of each picked card with the rest. There are two ordered
        // pairs for every distinct unordered pair so we multiply by 2.
        total > 0 && picked.length + basics.length > 0
          ? (2 * sum(picked.concat(basics).map((ci, i) => sumSynergy(ci, fst(picked.concat(basics), i), cards, p)))) /
            (picked.length + basics.length - 1) /
            sum(p)
          : 0,
    },
    {
      title: 'Colors',
      tooltip: 'A score of how well these colors fit in with the current picks.',
      perConsideredCard: false,
      weights: [
        [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
        [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40],
        [60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
      ],
      // How good are the cards we've already picked in this color combo?
      // Used to select a color combination.
      // Tends to recommend what we've already picked before.
      computeValue: ({ picked, basics, probabilities, cards }) =>
        sumWeightedRatings(picked.concat(basics), cards, probabilities),
    },
    {
      title: 'Openness',
      tooltip: 'A score of how open these colors appear to be.',
      perConsideredCard: true,
      weights: [
        [4, 12, 12.3, 12.6, 13, 13.4, 13.7, 14, 15, 14.6, 14.2, 13.8, 13.4, 13, 12.6],
        [13, 12.6, 12.2, 11.8, 11.4, 11, 10.6, 10.2, 9.8, 9.4, 9, 8.6, 8.2, 7.8, 7],
        [8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1],
      ],
      // Has this color combination been flowing openly?
      // Used to select a color combination. Tends to recommend new colors to try.
      computeValue: ({ seen, cards, probabilities }) => sumWeightedRatings(seen, cards, probabilities),
    },
  ].map((oracle) => ({ ...oracle, computeWeight: (drafterState) => calculateWeight(oracle.weights, drafterState) })),
);
export const ORACLES_BY_NAME = Object.freeze(fromEntries(ORACLES.map((oracle) => [oracle.title, oracle])));

const getCombinationForLands = (lands) => {
  const counts = fromEntries(COLORS.map((c) => [c, 0]));
  for (const [comb, count] of Object.entries(lands)) {
    for (const color of comb) {
      counts[color] += count;
    }
  }
  const combination = Object.entries(counts)
    .filter(([, count]) => count >= 3)
    .map(([c]) => c);
  return COLOR_COMBINATIONS.find((comb) => arraysAreEqualSets(combination, comb));
};

const getAvailableLands = (pool, basics, cards) => {
  const availableLands = new Uint8Array(32);
  for (const cardIndex of pool.concat(...basics.map((ci) => new Array(17).fill(ci)))) {
    const card = cards[cardIndex];
    if (cardType(card).toLowerCase().includes('land')) {
      const colors = FETCH_LANDS[cardName(card)] ?? cardColorIdentity(card);
      const key = (COLOR_COMBINATIONS.find((comb) => arraysAreEqualSets(comb, colors)) ?? []).join('');
      availableLands[COLOR_COMBINATION_INDICES[key]] += 1;
    }
  }
  return availableLands;
};

const getRandomLands = (availableLands) => {
  const currentLands = new Uint8Array(availableLands);
  let totalLands = currentLands.reduce((x, y) => x + y, 0);
  while (totalLands > 17) {
    const availableDecreases = [];
    for (let i = 0; i < 32; i++) {
      if (currentLands[i] > 0) availableDecreases.push(i);
    }
    const trueDecreases = availableDecreases.filter(
      (i) => !availableDecreases.some((j) => i !== j && COLOR_COMBINATION_INCLUDES[i * 32 + j]),
    );
    const index = Math.floor(Math.random() * trueDecreases.length);
    totalLands -= 1;
    currentLands[trueDecreases[index]] -= 1;
  }
  return currentLands;
};

const calculateProbabilities = ({ cards, seen, picked, basics, lands }) => {
  const seenSet = [...new Set(seen.concat(picked, basics))].map((ci) => [ci, cards[ci]]);
  const seenProbs = seenSet.map(([ci, card]) => [ci, getCastingProbability(card, lands)]);
  const res = cards.map(() => null);
  for (const [ci, prob] of seenProbs) {
    res[ci] = prob;
  }
  return res;
};

const calculateScore = (botState) => {
  const { picked, cards, probabilities, basics } = botState;
  const oracleResults = ORACLES.map(({ title, tooltip, computeWeight, computeValue }) => ({
    title,
    tooltip,
    weight: computeWeight(botState),
    value: computeValue(botState),
  }));
  const nonlandProbability = picked
    .concat(basics)
    .filter((c) => !cardType(cards[c]).toLowerCase().includes('land'))
    .reduce((acc, c) => acc + probabilities[c], 0);
  const score = oracleResults.reduce((acc, { weight, value }) => acc + weight * value, 0);
  return {
    score,
    oracleResults,
    botState,
    colors: getCombinationForLands(botState.lands),
    nonlandProbability,
  };
};

const findTransitions = ({ botState: { lands, availableLands } }) => {
  const availableIncreases = [];
  const availableDecreases = [];
  for (let i = 0; i < 32; i++) {
    if (availableLands[i] > lands[i]) availableIncreases.push(i);
    if (lands[i] > 0) availableDecreases.push(i);
  }
  const trueIncreases = availableIncreases.filter(
    (i) => !availableIncreases.some((j) => COLOR_COMBINATION_INCLUDES[i * 32 + j]),
  );
  const trueDecreases = availableDecreases.filter(
    (i) => !availableDecreases.some((j) => COLOR_COMBINATION_INCLUDES[j * 32 + i]),
  );
  const result = [];
  for (const increase of trueIncreases) {
    for (const decrease of trueDecreases) {
      if (!COLOR_COMBINATION_INCLUDES[increase * 32 + decrease]) {
        result.push([increase, decrease]);
      }
    }
  }
  return result;
};

const findBetterLands = (currentScore) => {
  const { botState } = currentScore;
  let result = currentScore;
  for (const [increase, decrease] of findTransitions(currentScore)) {
    const lands = new Uint8Array(botState.lands);
    lands[increase] += 1;
    lands[decrease] -= 1;
    const newBotState = { ...botState, lands };
    newBotState.probabilities = calculateProbabilities(newBotState);
    newBotState.sqrtProbabilities = newBotState.probabilities.map((p) => p && Math.sqrt(p));
    newBotState.totalProbability = sum(newBotState.probabilities);
    const newScore = calculateScore(newBotState);
    console.debug(newScore.score);
    if (newScore.score > result.score) {
      // We assume we won't get caught in a local maxima so it's safe to take first ascent.
      // return newScore;
      result = newScore;
    }
  }
  return result;
};

export const evaluateCardsOrPool = (cardIndices, drafterState) => {
  if ((cardIndices ?? null) === null) cardIndices = [];
  if (!Array.isArray(cardIndices)) cardIndices = [cardIndices];
  const initialBotState = { ...drafterState, cardIndices };
  initialBotState.availableLands = getAvailableLands(
    [...drafterState.picked, ...cardIndices],
    drafterState.basics,
    drafterState.cards,
  );
  initialBotState.lands = getRandomLands(initialBotState.availableLands);
  initialBotState.probabilities = calculateProbabilities(initialBotState);
  initialBotState.sqrtProbabilities = initialBotState.probabilities.map((p) => p && Math.sqrt(p));
  initialBotState.totalProbability = sum(initialBotState.probabilities);
  let currentScore = calculateScore(initialBotState);
  let prevScore = { ...currentScore, score: -1 };
  while (prevScore.score < currentScore.score) {
    prevScore = currentScore;
    currentScore = findBetterLands(currentScore);
  }
  console.log(currentScore);
  return currentScore;
};

export const calculateBotPick = (drafterState, reverse = false) =>
  drafterState.cardsInPack
    .map((cardIndex) => [evaluateCardsOrPool(cardIndex, drafterState).score, cardIndex])
    .sort(([a], [b]) => (reverse ? a - b : b - a))[0][1];

export const calculateBotPickFromOptions = (options) => (drafterState) =>
  options
    .map((packIndices) => packIndices.map((pi) => [drafterState.cardsInPack[pi], pi]).filter(([x]) => x || x === 0))
    .filter((option) => option.length > 0)
    .map((option) => [
      evaluateCardsOrPool(
        option.map(([x]) => x),
        drafterState,
      ).score,
      option,
    ])
    .sort(([a], [b]) => a - b)[0][1];
