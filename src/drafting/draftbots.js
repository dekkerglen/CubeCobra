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
import similarity from 'compute-cosine-similarity';

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
import { arrayShuffle, arraysAreEqualSets, fromEntries } from 'utils/Util';

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
  if (!card1?.details?.embedding?.length || !card2?.details?.embedding?.length) return 0;
  if (cardName(card1) === cardName(card2)) return MAX_SCORE;

  const name1 = cardName(card1);
  const name2 = cardName(card2);
  const key1 = `${name1}@@${name2}`;
  const synergy = synergyCache[key1];
  if (!synergy && synergy !== 0) {
    const similarityValue = similarity(card1.details.embedding, card2.details.embedding);

    if (Number.isFinite(similarityValue)) {
      synergyCache[key1] = 1 / (1 - scaleSimilarity(similarityValue)) - 1;
    } else {
      synergyCache[key1] = similarityValue > 0 ? MAX_SCORE : 0;
    }
    const key2 = `${name2}@@${name1}`;
    synergyCache[key2] = synergyCache[key1];
    return synergyCache[key1];
  }
  return synergy;
};

export const considerInCombination = (combination, card) =>
  card && COLOR_INCLUSION_MAP[combination.join('')][(cardColorIdentity(card) ?? []).join('')];

export const isPlayableLand = (colors, card) =>
  considerInCombination(colors, card) ||
  colors.filter((c) => cardColorIdentity(card).includes(c)).length > 1 ||
  (FETCH_LANDS[cardName(card)] && FETCH_LANDS[cardName(card)].some((c) => colors.includes(c)));

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
      if (!symbolUpper.includes('p') && !symbolUpper.includes('2')) {
        const unsortedSymbolColors = [...COLORS].filter((char) => symbolUpper.includes(char));
        if (unsortedSymbolColors.length > 0) {
          const symbolColors = COLOR_COMBINATIONS.find((comb) => arraysAreEqualSets(unsortedSymbolColors, comb));
          colorSymbols[symbolColors.join('')] = (colorSymbols[symbolColors.join('')] ?? 0) + 1;
        }
      }
    }
    // It woudl be nice if we could cache this value.
    colors = Object.entries(colorSymbols).map(([combination, count]) => [
      COLOR_COMBINATIONS.map((comb) => comb.join('')).filter((comb) => [...combination].some((c) => comb.includes(c))),
      count,
    ]);
    if (colors.length > 2) {
      colors = [
        ...colors,
        [
          COLOR_COMBINATIONS.map((c) => c.join('')).filter((comb) => colors.some(([combs]) => combs.includes(comb))),
          colors.reduce((acc, [, c]) => acc + c),
        ],
      ];
    }
    if (colors.length === 2) {
      colors = [
        [colors[0][0].filter((c) => !colors[1][0].includes(c)), colors[0][1]],
        [colors[1][0].filter((c) => !colors[0][0].includes(c)), colors[1][1]],
        colors[0][0].filter((c) => colors[1][0].includes(c)),
      ];
    }
    devotionsCache[name] = colors;
  }
  if (colors.length === 0) return 1;
  if (colors.length === 1) {
    const [[combs, devotion]] = colors;
    const landCount = combs.reduce((acc, c) => acc + (lands[c] ?? 0), 0);
    return probTable[cardCmc(card)]?.[devotion]?.[0]?.[landCount]?.[0]?.[0] ?? 0;
  }
  if (colors.length === 3) {
    const [[combsA, devotionA], [combsB, devotionB], combsAB] = colors;
    const landCountA = combsA.reduce((acc, c) => acc + (lands[c] ?? 0), 0);
    const landCountB = combsB.reduce((acc, c) => acc + (lands[c] ?? 0), 0);
    const landCountAB = combsAB.reduce((acc, c) => acc + (lands[c] ?? 0), 0);
    return probTable[cardCmc(card)]?.[devotionA]?.[devotionB]?.[landCountA]?.[landCountB]?.[landCountAB] ?? 0;
  }
  // This is a really poor approximation, it probably underestimates,
  // but could easily overestimate as well.
  return colors.reduce((acc, [combs, devotion]) => {
    const landCount = combs.reduce((acc2, c) => acc2 + (lands[c] ?? 0), 0);
    return acc * (probTable[cardCmc(card)]?.[devotion]?.[0]?.[landCount]?.[0]?.[0] ?? 0);
  }, 1);
};

const sum = (arr) => arr.reduce((acc, x) => acc + x, 0);
const fst = (arr, end) => arr.slice(0, end);

const eloToValue = (elo) => Math.sqrt(10 ** ((elo ?? 1200) / 400 - 4));

const sumWeightedRatings = (idxs, cards, p) =>
  idxs.length > 0 ? sum(idxs.map((c) => Math.min(MAX_SCORE, p[c] * eloToValue(cardElo(cards[c]))))) / idxs.length : 0;

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
      computeValue: ({ cardIndex, cards, probabilities }) => sumWeightedRatings([cardIndex], cards, probabilities),
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
      computeValue: ({ picked, cardIndex: ci, cards, probabilities: p }) =>
        picked.length > 0 ? sumSynergy(ci, picked, cards, p) / picked.length : 0,
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
      computeValue: ({ picked: arr, cards: cs, probabilities: ps, totalProbability: tp }) =>
        // The weighted sum of each pair's synergy divided by the total number of pairs is quadratic
        // in the ratio of playable cards. Then that ratio would be the dominant factor, dwarfing
        // the synergy values, which undermines our goal. Instead we can treat it as the weighted
        // average over the Pick Synergy of each picked card with the rest. There are two ordered
        // pairs for every distinct unordered pair so we multiply by 2.
        tp > 1 ? (2 * sum(arr.map((ci, i) => sumSynergy(ci, fst(arr, i), cs, ps)))) / arr.length / (tp - 1) : 0,
    },
    {
      title: 'Color',
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
      computeValue: ({ picked, probabilities, cards }) => sumWeightedRatings(picked, cards, probabilities),
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
  COLOR_COMBINATIONS.every((comb) => (count1[comb.join('')] ?? 0) === (count2[comb.join('')] ?? 0));

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

const getInitialLandsForPool = (pool, cards) => {
  const lands = { W: 4, U: 4, B: 3, R: 3, G: 3 };
  for (const cardIndex of pool) {
    const card = cards[cardIndex];
    if (cardType(card).toLowerCase().includes('land')) {
      const colors = FETCH_LANDS[cardName(card)] ?? cardColorIdentity(card);
      const key = COLOR_COMBINATIONS.find((comb) => arraysAreEqualSets(comb, colors))?.join?.('') ?? '';
      lands[key] = (lands[key] ?? 0) + 1;
      let removed = false;
      for (const color of colors) {
        if (lands[color] > 0) {
          removed = true;
          lands[color] -= 1;
          break;
        }
      }
      if (!removed) {
        const color = COLORS.find((c) => lands[c] > 0);
        if (color) lands[color] -= 1;
      }
    }
  }
  return lands;
};

const calculateProbabilities = ({ cards, seen, lands }) => {
  const seenSet = [...new Set(seen)].map((ci) => [ci, cards[ci]]);
  const seenProbs = seenSet.map(([ci, card]) => [ci, getCastingProbability(card, lands)]);
  const res = cards.map(() => null);
  for (const [ci, prob] of seenProbs) {
    res[ci] = prob;
  }
  return res;
};

const calculateScore = (botState) => {
  const { cardIndices, picked, cards, probabilities } = botState;
  const drafting = cardIndices.length > 0;
  const globalOracleResults = ORACLES.filter(({ perConsideredCard }) => !perConsideredCard).map(
    ({ title, tooltip, computeWeight, computeValue }) => ({
      title,
      tooltip,
      weight: computeWeight(botState),
      value: computeValue(botState),
    }),
  );
  if (drafting) {
    const perCardOracleResults = ORACLES.filter(({ perConsideredCard }) => perConsideredCard).map(
      ({ title, tooltip, computeWeight, computeValue }) => {
        const perCard = cardIndices.map((cardIndex) => computeValue({ ...botState, cardIndex }));
        return {
          title,
          tooltip,
          perCard,
          weight: computeWeight(botState),
          value: perCard.reduce((acc, x) => acc + x, 0),
        };
      },
    );
    const oracleResults = [...perCardOracleResults, ...globalOracleResults];
    const score = oracleResults.reduce((acc, { weight, value }) => acc + weight * value, 0);
    return {
      score,
      oracleResults,
      botState,
      probability: botState.probabilities[botState.cardIndex],
      colors: getCombinationForLands(botState.lands),
    };
  }
  const nonlandProbability = picked.reduce(
    (acc, c) => (acc + cardType(cards[c]).toLowerCase().includes('land') ? 0 : probabilities[c]),
    0,
  );
  const score = nonlandProbability * globalOracleResults.reduce((acc, { weight, value }) => acc + weight * value, 0);
  return {
    score,
    oracleResults: globalOracleResults,
    botState,
    probability: botState.probabilities[botState.cardIndex],
    colors: getCombinationForLands(botState.lands),
    nonlandProbability,
  };
};

const findBetterLands = (currentScore) => {
  const { botState, score } = currentScore;
  // This makes the bots non-deterministic are we good with that?
  for (const increaseColor of arrayShuffle([...COLORS])) {
    for (const decreaseColor of arrayShuffle(COLORS.filter((c) => increaseColor !== c && botState.lands[c] > 0))) {
      const lands = { ...botState.lands };
      lands[increaseColor] += 1;
      lands[decreaseColor] -= 1;
      const newBotState = { ...botState, lands };
      botState.probabilities = calculateProbabilities(newBotState);
      botState.totalProbability = sum(newBotState.probabilities);
      console.debug(
        'Testing the score at',
        lands,
        'which increases',
        increaseColor,
        'and decreases',
        decreaseColor,
        'and gives probabilities',
        newBotState.probabilities.filter((p) => p !== null),
      );
      const newScore = calculateScore(newBotState);
      if (newScore.score > score) {
        // We assume we won't get caught in a local maxima so it's safe to take first ascent.
        console.log('Improved by moving to', lands);
        return newScore;
      }
    }
  }
  console.debug('Did not find an increase from', currentScore.botState.lands);
  return currentScore;
};

export const evaluateCardsOrPool = (cardIndices, drafterState) => {
  if ((cardIndices ?? null) === null) cardIndices = [];
  if (!Array.isArray(cardIndices)) cardIndices = [cardIndices];
  let prevLands = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const initialBotState = { ...drafterState, cardIndices };
  initialBotState.lands = getInitialLandsForPool([...drafterState.picked, ...cardIndices], drafterState.cards);
  initialBotState.probabilities = calculateProbabilities(initialBotState);
  initialBotState.totalProbability = sum(initialBotState.probabilities);
  let currentScore = calculateScore(initialBotState);
  while (!landCountsAreEqual(prevLands, currentScore.botState.lands)) {
    prevLands = currentScore.botState.lands;
    currentScore = findBetterLands(currentScore);
  }
  return currentScore;
};

export const calculateBotPick = (drafterState, reverse = false) =>
  drafterState.cardsInPack
    .map((cardIndex) => [evaluateCardsOrPool(cardIndex, drafterState).score, cardIndex])
    .sort(([a], [b]) => (reverse ? a - b : b - a))[0][1];

const GRID_DRAFT_OPTIONS = [0, 1, 2]
  .map((ind) => [[0, 1, 2].map((offset) => 3 * ind + offset), [0, 1, 2].map((offset) => ind + 3 * offset)])
  .flat(1);

export const calculateGridBotPick = (gridDrafterState) =>
  GRID_DRAFT_OPTIONS.map((packIndices) =>
    packIndices.map((pi) => [gridDrafterState.cardsInPack[pi], pi]).filter(([x]) => x || x === 0),
  )
    .filter((option) => option.length > 0)
    .map((option) => [
      evaluateCardsOrPool(
        option.map(([x]) => x),
        gridDrafterState,
      ).score,
      option,
    ])
    .sort(([a], [b]) => a - b)[0][1];
