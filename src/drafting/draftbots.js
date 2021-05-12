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
import { arrayShuffle, arraysAreEqualSets, fromEntries, arrayIsSubset } from 'utils/Util';

import probTable from 'res/probTable.json';

// Ignore synergy below this value.
const SIMILARITY_CLIP = 0.7;
const SIMILARITY_MULTIPLIER = 1 / (1 - SIMILARITY_CLIP);
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

const scaleSimilarity = (value) => SIMILARITY_MULTIPLIER * Math.max(0, value - SIMILARITY_CLIP);

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
    if (!card1?.details?.embedding?.length || !card2?.details?.embedding?.length || name1 === name2) {
      synergy = 0;
    } else {
      const similarityValue = card1.details.embedding.reduce((acc, x, i) => acc + x * card2.details.embedding[i], 0);
      if (Number.isFinite(similarityValue)) {
        synergy = 1 / (1 - scaleSimilarity(similarityValue)) - 1;
      } else {
        synergy = similarityValue > 0 ? MAX_SCORE : 0;
      }
    }
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

// TODO: Use learnings from draftbot optimization to make this much faster.
const devotionsCache = {};
export const getCastingProbability = (card, lands) => {
  const name = cardName(card);
  let colors = devotionsCache[name];
  if ((colors ?? null) === null) {
    const cost = cardCost(card);
    if (cardType(card).toLowerCase().includes('land') || cardIsSpecialZoneType(card) || !cost?.length) return 1;
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
    // It woudl be nice if we could cache this value.
    colors = Object.entries(colorSymbols).map(([combination, count]) => [
      COLOR_COMBINATIONS.map((comb) => comb.join('')).filter((comb) => [...combination].some((c) => comb.includes(c))),
      Math.min(count, 6),
    ]);
    if (colors.length > 2) {
      colors = [
        ...colors.map(([combination, count]) => [
          COLOR_COMBINATIONS.map((comb) => comb.join('')).filter((comb) =>
            [...combination].some((c) => comb.includes(c)),
          ),
          Math.min(count, 6),
        ]),
        [
          COLOR_COMBINATIONS.map((c) => c.join('')).filter((comb) => colors.some(([combs]) => combs.includes(comb))),
          Math.min(
            colors.reduce((acc, [, c]) => acc + c),
            6,
          ),
        ],
      ];
    }
    if (colors.length === 2) {
      colors = [
        [colors[0][0].filter((c) => !colors[1][0].includes(c)), colors[0][1]],
        [colors[1][0].filter((c) => !colors[0][0].includes(c)), colors[1][1]],
        colors[0][0].filter((c) => colors[1][0].includes(c)),
      ];
      if (colors[0][1] > colors[1][1]) {
        const temp = colors[1];
        [colors[1]] = colors;
        colors[0] = temp;
      }
      colors[0][1] = Math.min(colors[0][1], 6);
      colors[1][1] = Math.min(colors[1][1], 3);
    }
    devotionsCache[name] = colors;
  }
  if (colors.length === 0) return 1;
  if (colors.length === 1) {
    const [[combs, devotion]] = colors;
    const landCount = combs.reduce((acc, c) => acc + (lands[c] ?? 0), 0);
    // console.debug(
    //   cardName(card),
    //   cardCmc(card),
    //   devotion,
    //   landCount,
    //   combs.map((comb) => [comb, lands[comb]]).filter(([, c]) => c > 0),
    // );
    return probTable[Math.min(cardCmc(card), 8)]?.[devotion]?.[0]?.[landCount]?.[0]?.[0] ?? 0;
  }
  if (colors.length === 3) {
    const [[combsA, devotionA], [combsB, devotionB], combsAB] = colors;
    const landCountA = combsA.reduce((acc, c) => acc + (lands[c] ?? 0), 0);
    const landCountB = combsB.reduce((acc, c) => acc + (lands[c] ?? 0), 0);
    const landCountAB = combsAB.reduce((acc, c) => acc + (lands[c] ?? 0), 0);
    return (
      probTable[Math.min(cardCmc(card), 8)]?.[devotionA]?.[devotionB]?.[landCountA]?.[landCountB]?.[landCountAB] ?? 0
    );
  }
  // This is a really poor approximation, it probably underestimates,
  // but could easily overestimate as well.
  return colors.reduce((acc, [combs, devotion]) => {
    const landCount = combs.reduce((acc2, c) => acc2 + (lands[c] ?? 0), 0);
    return acc * (probTable[Math.min(cardCmc(card), 8)]?.[devotion]?.[0]?.[landCount]?.[0]?.[0] ?? 0);
  }, 1);
};

const sum = (arr) => arr.reduce((acc, x) => acc + x, 0);
const fst = (arr, end) => arr.slice(0, end);

const eloToValue = (elo) => Math.sqrt(10 ** (((elo ?? 1200) - 1200) / 800));

const sumWeightedRatings = (idxs, cards, p, countLands = false) => {
  idxs = idxs.filter((ci) => !cardType(cards[ci]).toLowerCase().includes('land') || countLands);
  if (idxs.length === 0) return 0;
  // console.debug(
  //   'value[idxs]',
  //   idxs.map((ci) => eloToValue(cardElo(cards[ci]))),
  //   'prob[idxs]',
  //   idxs.map((ci) => p[ci]),
  // );
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
      computeValue: ({ picked, cardIndices, cards, probabilities: p, basics }) =>
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
      computeValue: ({ picked, cards, probabilities: p, totalProbability: total, basics }) =>
        // The weighted sum of each pair's synergy divided by the total number of pairs is quadratic
        // in the ratio of playable cards. Then that ratio would be the dominant factor, dwarfing
        // the synergy values, which undermines our goal. Instead we can treat it as the weighted
        // average over the Pick Synergy of each picked card with the rest. There are two ordered
        // pairs for every distinct unordered pair so we multiply by 2.
        total > 1 && picked.length + basics.length > 0
          ? (2 * sum(picked.concat(basics).map((ci, i) => sumSynergy(ci, fst(picked.concat(basics), i), cards, p)))) /
            (picked.length + basics.length) /
            (total - 1)
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

const landCountsAreEqual = (count1, count2) =>
  !Object.entries(count1).some(([k, v]) => v !== (count2[k] ?? 0)) &&
  !Object.entries(count2).some(([k, v]) => v !== (count1[k] ?? 0));

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
  const availableLands = {};
  for (const cardIndex of pool.concat(...basics.map((ci) => new Array(17).fill(ci)))) {
    const card = cards[cardIndex];
    if (cardType(card).toLowerCase().includes('land')) {
      const colors = FETCH_LANDS[cardName(card)] ?? cardColorIdentity(card);
      const key = (COLOR_COMBINATIONS.find((comb) => arraysAreEqualSets(comb, colors)) ?? []).join('');
      availableLands[key] = (availableLands[key] ?? 0) + 1;
    }
  }
  return availableLands;
};

const getRandomLands = (availableLands) => {
  const currentLands = { ...availableLands };
  let totalLands = Object.values(currentLands).reduce((x, y) => x + y, 0);
  while (totalLands > 17) {
    const availableDecreases = Object.keys(currentLands).filter((comb) => (currentLands[comb] ?? 0) > 0);
    const trueDecreases = availableDecreases.filter(
      (comb) =>
        !availableDecreases.some(
          (comb2) => arrayIsSubset([...comb2], [...comb]) && !arraysAreEqualSets([...comb2], [...comb]),
        ),
    );
    const index = Math.floor(Math.random() * trueDecreases.length);
    totalLands -= 1;
    const key = trueDecreases[index];
    currentLands[key] -= 1;
    if (currentLands[key] === 0) {
      delete currentLands[key];
    }
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
  const availableIncreases = Object.keys(availableLands).filter((comb) => availableLands[comb] > lands[comb] ?? 0);
  const availableDecreases = Object.keys(lands).filter((comb) => (lands[comb] ?? 0) > 0);
  console.log('increases:', availableIncreases, 'decreases', availableDecreases);
  const trueIncreases = availableIncreases.filter(
    (comb) =>
      !availableIncreases.some(
        (comb2) => arrayIsSubset([...comb], [...comb2]) && !arraysAreEqualSets([...comb], [...comb2]),
      ),
  );
  const trueDecreases = availableDecreases.filter(
    (comb) =>
      !availableDecreases.some(
        (comb2) => arrayIsSubset([...comb2], [...comb]) && !arraysAreEqualSets([...comb2], [...comb]),
      ),
  );
  const result = [];
  for (const increase of trueIncreases) {
    for (const decrease of trueDecreases) {
      if (!arrayIsSubset([...increase], [...decrease])) {
        result.push([increase, decrease]);
      }
    }
  }
  console.log('Transitions', result);
  return result;
};

const findBetterLands = (currentScore) => {
  const { botState } = currentScore;
  console.debug(
    '\n\nCurrent score is',
    currentScore.score,
    'with',
    Object.entries(botState.lands)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([comb, count]) => `${comb}-${count}`)
      .join(','),
    'and totalProb',
    currentScore.totalProbability,
    'scoreObj',
    currentScore,
  );
  let result = currentScore;
  // This makes the bots non-deterministic are we good with that?
  for (const [increase, decrease] of findTransitions(currentScore)) {
    const lands = { ...botState.lands };
    lands[increase] = (lands[increase] ?? 0) + 1;
    lands[decrease] -= 1;
    if (lands[decrease] === 0) {
      delete lands[decrease];
    }
    const newBotState = { ...botState, lands };
    botState.probabilities = calculateProbabilities(newBotState);
    botState.totalProbability = sum(newBotState.probabilities);
    const newScore = calculateScore(newBotState);
    // console.debug(
    //   'trying',
    //   Object.entries(lands)
    //     .sort(([a], [b]) => a.localeCompare(b))
    //     .map(([comb, count]) => `${comb}-${count}`)
    //     .join(','),
    //   'with',
    //   newScore.score,
    //   'and scoreObj',
    //   newScore,
    // );
    if (newScore.score > result.score) {
      // We assume we won't get caught in a local maxima so it's safe to take first ascent.
      // return newScore;
      console.debug(
        'ADOPTED\nCurrent score is',
        newScore.score,
        'with',
        Object.entries(newScore.botState.lands)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([comb, count]) => `${comb}-${count}`)
          .join(','),
        'and totalProb',
        newScore.nonlandProbability,
        'scoreObj',
        newScore,
      );
      console.debug(
        newScore.botState.probabilities
          .map((prob, ci) => [prob, result.botState.probabilities[ci], cardName(botState.cards[ci])])
          .filter(([p, p2]) => p !== null && p2 !== null),
      );
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
  initialBotState.totalProbability = sum(initialBotState.probabilities);
  let currentScore = calculateScore(initialBotState);
  let prevScore = { ...currentScore, score: -1 };
  while (prevScore.score < currentScore.score) {
    console.log('Checking transitions.');
    prevScore = currentScore;
    currentScore = findBetterLands(currentScore);
  }
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
