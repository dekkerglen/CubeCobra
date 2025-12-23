import {
  BASIC_LAND_MANA_MAPPING,
  cardCmc,
  cardColorsAsManaSymbols,
  cardIsLand,
  cardManaProduced,
  cardManaSymbols,
  cardOracleId,
  cardOracleText,
  cardType,
} from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import { ManaSymbol, ManaSymbols } from '@utils/datatypes/Mana';

type Deck = Card[];

type ColorDistribution = Record<ManaSymbol, number> & { total: number };

export const getManaSymbolCount = (deck: Deck): ColorDistribution => {
  return deck
    .map((card: Card) => cardManaSymbols(card))
    .flat()
    .reduce(
      (acc, symbol: ManaSymbol) => {
        acc[symbol] = (acc[symbol] || 0) + 1;
        acc.total += 1;
        return acc;
      },
      {
        ...Object.fromEntries(ManaSymbols.map((symbol) => [symbol, 0])),
        total: 0,
      } as ColorDistribution,
    );
};

export const getCardCountByColor = (deck: Deck) => {
  const colorsInDeck: ColorDistribution = deck
    .map((card: Card) => cardColorsAsManaSymbols(card))
    .flat()
    .reduce(
      (acc, str: ManaSymbol) => {
        acc[str] = (acc[str] || 0) + 1;
        return acc;
      },
      {
        ...Object.fromEntries(ManaSymbols.map((symbol) => [symbol, 0])),
        total: 0,
      } as ColorDistribution,
    );

  colorsInDeck.total = deck.length;

  return colorsInDeck;
};

/**
 * For a given deck, returns the number of sources for each color including fetches. This only includes lands.
 */
export const getSourcesDistribution = (deck: Deck, includeNonLands: boolean = false): ColorDistribution => {
  const distribution = {
    ...Object.fromEntries(ManaSymbols.map((symbol) => [symbol, 0])),
    total: 0,
  } as ColorDistribution;

  const manaProducersInDeck = deck.filter((card: Card) =>
    includeNonLands ? cardManaProduced(card).length > 0 || cardIsLand(card) : cardIsLand(card),
  );

  for (const card of manaProducersInDeck) {
    // If the land produces mana we'll just add it as a source already
    const produces = cardManaProduced(card);
    if (produces.length > 0) {
      produces.forEach((manaSymbol) => {
        distribution[manaSymbol] = (distribution[manaSymbol] || 0) + 1;
      });

      distribution.total = distribution.total + 1;

      continue;
    }

    // If it doesn't produce any mana it might be a fetchland
    const fetchableColors = getFetchableColors(deck, card);
    fetchableColors.forEach((manaSymbol) => {
      distribution[manaSymbol] = (distribution[manaSymbol] || 0) + 1;
    });
    if (fetchableColors.size > 0) {
      distribution.total = distribution.total + 1;
    }
  }

  return distribution;
};

const fetchPattern =
  /[Ss]earch your library for (?:a (?<anyBasic>basic land) card|a basic (?<basicType1>[A-Za-z]+)(?:, (?<basicType2>[A-Za-z]+))?(?:,? or (?<basicType3>[A-Za-z]+))? card|an? (?<landType1>[A-Za-z]+) or (?<landType2>[A-Za-z]+) card)/;

const fetchWithMyriadLandscape = (deck: Deck): Set<ManaSymbol> => {
  // {2}, {T}, Sacrifice Myriad Landscape: Search your library for up to two basic land cards that share a land type,
  // put them onto the battlefield tapped, then shuffle.

  // You can fetch a single basic with Myriad Landscape so we don't need to worry about only basics that have 2 or more copies in the deck
  const fetchableColors = new Set<ManaSymbol>();

  for (const card of deck) {
    if (!cardType(card).includes('Land')) {
      continue;
    }

    if (cardType(card).includes('Basic Land')) {
      const producedMana = card.details?.produced_mana ?? [];
      if (producedMana.length > 0 && producedMana[0]) {
        fetchableColors.add(producedMana[0]);
      }
    }
  }

  return fetchableColors;
};

// Some fetches have special handling that is tricky to handle with a regexp. This maps oracleIDs to functions containing the fetching logic.
const specialFetches: Record<string, (deck: Deck) => Set<ManaSymbol>> = {
  '2549bc57-9ffb-4053-9f10-f2a5f792b845': fetchWithMyriadLandscape,
};

/**
 * Returns all the colors that can be fetched from the deck with the provided fetch land. This is useful to determine
 * if a given fetch land should count as a source for any color.
 * @param deck
 * @param fetchLand
 */
export const getFetchableColors = (deck: Deck, fetchLand: Card): Set<ManaSymbol> => {
  const fetchableColors = new Set<ManaSymbol>();

  // First check if the card is a special case we're handling
  const fn = specialFetches[cardOracleId(fetchLand)];
  if (fn) {
    return fn(deck);
  }

  const match = cardOracleText(fetchLand).match(fetchPattern);

  if (!match || !match.groups) {
    return fetchableColors;
  }

  const fetchableBasics = new Set<string>(); // Only for "basic land card"
  const fetchableLandTypes = new Set<string>(); // Can include non-basic lands

  if (match.groups.anyBasic) {
    Object.keys(BASIC_LAND_MANA_MAPPING).forEach((basicLand) => fetchableBasics.add(basicLand));
  }

  [match.groups.basicType1, match.groups.basicType2, match.groups.basicType3].forEach((basicLand) => {
    if (basicLand) {
      fetchableBasics.add(basicLand);
    }
  });

  [match.groups.landType1, match.groups.landType2].forEach((landType) => {
    if (landType) {
      fetchableLandTypes.add(landType);
    }
  });

  for (const land of deck) {
    if (!cardType(land).includes('Land')) {
      continue;
    }

    const landColors = land.details?.produced_mana ?? [];
    const isBasic = cardType(land).includes('Basic Land');

    // If looking for a "basic land card", only match basic lands
    if (isBasic && [...fetchableBasics].some((basic) => cardType(land).includes(basic))) {
      landColors.forEach((color: ManaSymbol) => fetchableColors.add(color));
    }

    // Otherwise look at land types
    if ([...fetchableLandTypes].some((type) => cardType(land).includes(type))) {
      landColors.forEach((color: ManaSymbol) => fetchableColors.add(color));
    }
  }

  return fetchableColors;
};

export const getCurveByColors = (deck: Deck, buckets: number[]): Record<ManaSymbol, number[]> => {
  const histogram: Record<ManaSymbol, number[]> = Object.fromEntries(
    ManaSymbols.map((color) => [color, new Array(buckets.length).fill(0)]),
  ) as Record<ManaSymbol, number[]>;

  // Sort buckets to ensure they are in ascending order
  const sortedBuckets = [...buckets].sort((a, b) => a - b);

  for (const card of deck) {
    const cmc = cardCmc(card);
    const colors = cardColorsAsManaSymbols(card);

    // Find the appropriate bucket index for the card's CMC
    let bucketIndex = sortedBuckets.findIndex((bucket) => cmc <= bucket);
    if (bucketIndex === -1) {
      bucketIndex = sortedBuckets.length - 1; // If CMC exceeds all buckets, place it in the last bucket
    }

    // If the card has no colors let's count it as colorless
    if (colors.length === 0) {
      colors.push('C');
    }

    // Increment the count for each color the card has
    for (const color of colors) {
      histogram[color][bucketIndex] = (histogram[color][bucketIndex] ?? 0) + 1;
    }
  }

  return histogram;
};
