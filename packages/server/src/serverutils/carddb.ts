import { filterCardsDetails, FilterFunction } from '@utils/filtering/FilterCards';
import { detailsToCard, reasonableCard } from '@utils/cardutil';
import { SortFunctions } from '@utils/sorting/Sort';
import { CardDetails, PrintingPreference, SUPPORTED_FORMATS } from '@utils/datatypes/Card';
import catalog from 'serverutils/cardCatalog';

// eslint-disable-next-line camelcase
export function getPlaceholderCard(scryfall_id: string): CardDetails {
  // placeholder card if we don't find the one due to a scryfall ID update bug
  return {
    scryfall_id,
    oracle_id: '',
    released_at: '',
    isToken: false,
    finishes: [],
    set: '',
    setIndex: -1,
    collector_number: '',
    promo: false,
    reprint: false,
    digital: false,
    full_name: 'Invalid Card',
    name: 'Invalid Card',
    name_lower: 'invalid card',
    artist: '',
    scryfall_uri: '',
    rarity: '',
    legalities: Object.fromEntries(SUPPORTED_FORMATS.map((format) => [format, 'not_legal' as const])),
    oracle_text: '',
    image_normal: 'https://img.scryfall.com/errors/missing.jpg',
    cmc: 0,
    type: '',
    colors: [],
    color_identity: [],
    parsed_cost: [],
    colorcategory: 'Colorless',
    border_color: 'black',
    language: 'en',
    mtgo_id: 0,
    layout: '',
    tcgplayer_id: '',
    power: '',
    toughness: '',
    loyalty: '',
    error: true,
    full_art: false,
    prices: {},
    tokens: [],
    set_name: '',
    produced_mana: [],
    keywords: [],
    games: [],
    reserved: false,
  };
}

export function cardFromId(id: string): CardDetails {
  let details;
  if (catalog._carddict[id]) {
    details = catalog._carddict[id];
  } else if (catalog.oracleToId[id]) {
    details = getFirstReasonable(catalog.oracleToId[id]);
  } else {
    details = getPlaceholderCard(id);
  }

  return details;
}

export function reasonableId(id: string): boolean {
  return reasonableCard(cardFromId(id));
}

export function getNameForComparison(name: string): string {
  return name
    .trim()
    .normalize('NFD') // convert to consistent unicode format
    .replace(/[\u0300-\u036f]/g, '') // remove unicode
    .toLowerCase();
}

export function getIdsFromName(name: string): string[] {
  if (!name) {
    return [];
  }

  // this is a fully-spcecified card name
  if (name.includes('[') && name.includes(']')) {
    name = name.toLowerCase();
    const split = name.split('[');

    const firstPart = split[0];
    if (!firstPart) {
      return [];
    }

    return (getIdsFromName(firstPart) || [])
      .map((id) => cardFromId(id))
      .filter((card) => getNameForComparison(card.full_name) === getNameForComparison(name))
      .map((card) => card.scryfall_id);
  }

  return catalog.nameToId[getNameForComparison(name)] || [];
}

export function getMostReasonable(
  cardName: string,
  printing: PrintingPreference = PrintingPreference.RECENT,
  filter?: FilterFunction,
): CardDetails | null {
  const ids = getIdsFromName(cardName);
  if (ids === undefined || ids.length === 0) {
    // Try getting it by ID in case this is an ID.

    return getMostReasonableById(cardName, printing);
  }

  return getMostReasonableByPrintingPreference(ids, printing, filter);
}

export function getMostReasonableByPrintingPreference(
  ids: string[],
  printingPreference: PrintingPreference = PrintingPreference.RECENT,
  filter?: FilterFunction,
): CardDetails | null {
  if (filter) {
    ids = ids
      .map((id) => detailsToCard(cardFromId(id)))
      .filter(filter)
      .map((card) => card.details?.scryfall_id)
      .filter((id) => id !== undefined) as string[];
  }

  if (ids.length === 0) {
    return null;
  }

  // sort chronologically by default
  const cards = ids.map((id) => ({
    details: cardFromId(id),
  }));
  cards.sort((a, b) => {
    const releaseDateSort = SortFunctions['Release date'];
    const collectorNumberSort = SortFunctions['Collector number'];

    if (!releaseDateSort || !collectorNumberSort) {
      return 0;
    }

    const dateCompare = releaseDateSort(a, b);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return collectorNumberSort(a, b);
  });

  ids = cards.map((card) => card.details.scryfall_id);

  // Ids have been sorted from oldest to newest. So reverse if we want the newest printing.
  if (printingPreference === PrintingPreference.RECENT) {
    ids = [...ids];
    ids.reverse();
  }
  return cardFromId(ids.find(reasonableId) || ids[0] || '');
}

export function getMostReasonableById(
  id: string,
  printing: PrintingPreference = PrintingPreference.RECENT,
  filter?: FilterFunction,
): CardDetails | null {
  const card = cardFromId(id);
  if (card.error) {
    return null;
  }
  return getMostReasonable(card.name, printing, filter);
}

export function getFirstReasonable(ids: string[]): CardDetails {
  return cardFromId(ids.find(reasonableId) || ids[0] || '');
}

export function getEnglishVersion(id: string): string {
  return catalog.english[id] || id;
}

export function getVersionsByOracleId(oracleId: string): string[] {
  return catalog.oracleToId[oracleId] || [];
}

export function getReasonableCardByOracle(oracleId: string): CardDetails {
  const ids = catalog.oracleToId[oracleId];
  if (!ids || ids.length === 0) {
    return getPlaceholderCard('');
  }
  return getFirstReasonable(ids);
}

export function getReasonableCardByOracleWithPrintingPreference(
  oracleId: string,
  printingPreference: PrintingPreference,
): CardDetails {
  const ids = catalog.oracleToId[oracleId];
  if (!ids || ids.length === 0) {
    return getPlaceholderCard('');
  }
  return getMostReasonableByPrintingPreference(ids, printingPreference)!;
}

export function isOracleBasic(oracleId: string): boolean {
  const ids = catalog.oracleToId[oracleId];
  if (!ids || ids.length === 0) {
    return false;
  }
  return cardFromId(ids[0] || '').type.includes('Basic');
}

const indexToReasonable = (index: number): CardDetails => {
  const oracleId = catalog.indexToOracle[index];
  if (!oracleId) {
    return getPlaceholderCard('');
  }
  const ids = catalog.oracleToId[oracleId];
  if (!ids || ids.length === 0) {
    return getPlaceholderCard('');
  }
  return getFirstReasonable(ids);
};

const indexToReasonableWithPrintingPreference = (
  index: number,
  printingPreference: PrintingPreference,
): CardDetails => {
  const oracleId = catalog.indexToOracle[index];
  if (!oracleId) {
    return getPlaceholderCard('');
  }
  const ids = catalog.oracleToId[oracleId];
  if (!ids || ids.length === 0) {
    return getPlaceholderCard('');
  }
  //Use ! to tell Typescript we expect to always get a card here, because we are going through
  //the catalog that CubeCobra built. Thus expect consistency
  return getMostReasonableByPrintingPreference(ids, printingPreference)!;
};

export function getRelatedCards(
  oracleId: string,
  printingPreference: PrintingPreference,
): Record<string, Record<string, CardDetails[]>> {
  const related = catalog.metadatadict[oracleId];

  if (!related) {
    return {
      cubedWith: {
        top: [],
        creatures: [],
        spells: [],
        other: [],
      },
      draftedWith: {
        top: [],
        creatures: [],
        spells: [],
        other: [],
      },
      synergistic: {
        top: [],
        creatures: [],
        spells: [],
        other: [],
      },
    };
  }

  const mapper = (oracleIndex: number) => {
    return indexToReasonableWithPrintingPreference(oracleIndex, printingPreference);
  };

  return {
    cubedWith: {
      top: related.cubedWith.top.map(mapper),
      creatures: related.cubedWith.creatures.map(mapper),
      spells: related.cubedWith.spells.map(mapper),
      other: related.cubedWith.other.map(mapper),
    },
    draftedWith: {
      top: related.draftedWith.top.map(mapper),
      creatures: related.draftedWith.creatures.map(mapper),
      spells: related.draftedWith.spells.map(mapper),
      other: related.draftedWith.other.map(mapper),
    },
    synergistic: {
      top: related.synergistic.top.map(mapper),
      creatures: related.synergistic.creatures.map(mapper),
      spells: related.synergistic.spells.map(mapper),
      other: related.synergistic.other.map(mapper),
    },
  };
}

// if the oracle id is not in the training data, we will use the similar card in the metadata dict
export function getOracleForMl(oracleId: string, printingPreference: PrintingPreference | null): string {
  const related = catalog.metadatadict[oracleId];

  if (!related || related.mostSimilar === undefined) {
    return oracleId;
  }

  if (printingPreference) {
    return indexToReasonableWithPrintingPreference(related.mostSimilar, printingPreference).oracle_id;
  } else {
    return indexToReasonable(related.mostSimilar).oracle_id;
  }
}

export function getAllMostReasonable(
  filter: FilterFunction,
  printing: PrintingPreference = PrintingPreference.RECENT,
): CardDetails[] {
  const cards = filterCardsDetails(catalog.printedCardList, filter);

  const keys = new Set();
  const filtered = [];
  for (const card of cards) {
    if (!keys.has(card.name_lower)) {
      filtered.push(getMostReasonableById(card.scryfall_id, printing, filter));
      keys.add(card.name_lower);
    }
  }
  return filtered.filter((card) => card !== null) as CardDetails[];
}

/**
 * Get all versions of a card, including printed and digital versions.
 *
 * Some cards may have multiple versions with the same oracle ID and the same name (e.g., reprints).
 * Some cards have multiple versions with different names, but the same oracle id (through the omenpaths "OM1")
 * Some cards have different oracle ids, but the same name (e.g. "Everythingamajig")
 *
 * @param card the card to get all versions for
 * @returns an array of all version IDs for the card
 */
export function getAllVersionIds(card: CardDetails): string[] {
  return [...new Set([...getVersionsByOracleId(card.oracle_id), ...getIdsFromName(card.name)])];
}

export function allCards() {
  return Object.values(catalog._carddict);
}

export function getAllOracleIds() {
  return Object.keys(catalog.oracleToId);
}

export function normalizedName(card: CardDetails) {
  return card.name_lower;
}

export default catalog;
