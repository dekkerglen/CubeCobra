import seedrandom from 'seedrandom';

import Card from 'datatypes/Card';
import Cube from 'datatypes/Cube';
import Draft, { createDefaultDraftFormat, DraftFormat, DraftState } from 'datatypes/Draft';
import User from 'datatypes/User';
import { fromEntries } from 'utils/Util';
import { compileFilter, Filter } from './draftFilter';

type RNGFunction = () => number;

interface DraftParams {
  id: number;
  packs: number;
  cards?: number;
  players: number;
}

interface DraftResult {
  card: Card | undefined;
  messages: string[];
}

type NextCardFn = (cardFilters: string[]) => DraftResult;

interface AsfanResult {
  card: boolean;
  messages: string[];
}

type AsfanFn = (cardFilters: string[]) => AsfanResult;

interface CreatePacksResult {
  ok: boolean;
  messages: string[];
  initialState: DraftState;
  cards: Card[];
}

interface CheckResult {
  ok: boolean;
  messages: string[];
}
type CheckFn = (cardFilters: string[]) => CheckResult;

const matchingCards = (cards: Card[], filter: Filter): Card[] => {
  // Implement the matchingCards function
  return cards.filter(filter.fn);
};

const createNextCardFn = (cards: Card[], duplicates: boolean = false, rng: RNGFunction): NextCardFn => {
  return (cardFilters: string[]): DraftResult => {
    if (cards.length === 0) {
      throw new Error('Unable to create draft: not enough cards.');
    }

    // each filter is an array of parsed filter tokens, we choose one randomly
    let validCards = cards;
    let index: number | null = null;
    const messages: string[] = [];
    if (cardFilters.length > 0) {
      do {
        index = Math.floor(rng() * cardFilters.length);
        const filter = compileFilter(cardFilters[index]);
        validCards = matchingCards(cards, filter);
        if (validCards.length === 0) {
          // TODO: display warnings for players
          messages.push(`Warning: no cards matching filter: ${filter.filterText}`);
          // try another options and remove this filter as it is now empty
          cardFilters.splice(index, 1);
        }
      } while (validCards.length === 0 && cardFilters.length > 0);
    }

    if (validCards.length === 0) {
      throw new Error(`Unable to create draft: not enough cards matching filter.\n${messages.join('\n')}`);
    }

    index = Math.floor(rng() * validCards.length);

    // slice out the first card with the index, or error out
    const card = validCards[index];
    if (!duplicates) {
      // remove from cards
      index = cards.indexOf(card);
      cards.splice(index, 1);
    }

    return { card, messages };
  };
};

const createAsfanFn = (cards: Card[], duplicates: boolean = false): AsfanFn => {
  return (cardFilters: string[]): AsfanResult => {
    if (cards.length === 0) {
      throw new Error('Unable to create draft asfan: not enough cards.');
    }

    // each filter is an array of parsed filter tokens, we choose one randomly
    const validCardGroups: Card[][] = [];
    for (let i = 0; i < cardFilters.length; i++) {
      const filter = compileFilter(cardFilters[i]);
      let validCards = matchingCards(cards, filter);
      if (!duplicates) {
        validCards = validCards.filter((card) => (card.asfan || 0) < 1);
      }
      if (validCards.length > 0) {
        validCardGroups.push(validCards);
      }
    }

    if (validCardGroups.length === 0) {
      throw new Error('Unable to create draft asfan: not enough cards matching filter.');
    }
    for (const validCards of validCardGroups) {
      if (duplicates) {
        // This one's simple 1 / number of cards to pick from / number of filters to choose from
        const poolCount = validCards.length;
        const poolWeight = 1 / poolCount / validCardGroups.length;
        for (const card of validCards) {
          card.asfan = (card.asfan || 0) + poolWeight;
        }
      } else {
        // This is the expected number of cards to still be in the pool we're pulling out of
        // otherwise this is the same as above for poolWeight.
        const poolCount = validCards.reduce((sum, card) => sum + (1 - (card.asfan || 0)), 0);
        const poolWeight = 1 / poolCount / validCardGroups.length;
        for (const card of validCards) {
          // The 1 - card.asfan is the odds that it is still in the pool.
          card.asfan = (card.asfan || 0) + (1 - (card.asfan || 0)) * poolWeight;
        }
      }
    }
    return { card: true, messages: [] };
  };
};

export const getDraftFormat = (params: DraftParams, cube: Cube): DraftFormat => {
  if (params.id >= 0) {
    return cube.formats[params.id];
  }
  return createDefaultDraftFormat(params.packs, params.cards || 15);
};

const createPacks = (format: DraftFormat, seats: number, nextCardFn: NextCardFn): CreatePacksResult => {
  let ok = true;
  let messages: string[] = [];
  const result: CreatePacksResult = { ok, messages, initialState: [], cards: [] };
  for (let seat = 0; seat < seats; seat++) {
    result.initialState.push([]);
    for (let packNum = 0; packNum < format.packs.length; packNum++) {
      result.initialState[seat].push({ steps: [], cards: [] });
      const cards: Card[] = [];
      for (let cardNum = 0; cardNum < format.packs[packNum].slots.length; cardNum++) {
        const result = nextCardFn(format.packs[packNum].slots[cardNum].split(','));
        if (result.messages && result.messages.length > 0) {
          messages = messages.concat(result.messages);
        }
        if (result.card) {
          cards.push(result.card);
        } else {
          ok = false;
        }
      }

      result.initialState[seat][packNum] = {
        steps: format.packs[packNum].steps || [],
        cards: [],
      };

      for (const card of cards) {
        result.cards.push(card);
        result.initialState[seat][packNum].cards.push(result.cards.length - 1);
      }
    }
  }
  return result;
};

export const createDraft = (
  cube: Cube,
  format: DraftFormat,
  cubeCards: Card[],
  seats: number,
  user: User,
  seed: string | false = false,
): Draft => {
  if (!seed) {
    seed = Date.now().toString();
  }
  const rng = seedrandom(seed);

  let nextCardFn: NextCardFn | null = null;
  if (cubeCards.length === 0) {
    throw new Error('Unable to create draft: no cards.');
  }

  nextCardFn = createNextCardFn(cubeCards, format.multiples, rng);

  const result: CreatePacksResult = createPacks(format, seats, nextCardFn);

  if (!result.ok) {
    throw new Error(`Could not create draft:\n${result.messages.join('\n')}`);
  }

  const draft: Draft = {
    seats: [],
    cards: result.cards,
    seed,
    cube: cube.id,
    InitialState: result.initialState,
    basics: [],
    id: '',
    type: 'd',
    owner: user.id,
    cubeOwner: cube.owner,
    date: new Date(),
    name: '',
  };

  draft.seats = draft.InitialState!.map((_, seatIndex) => ({
    bot: seatIndex !== 0,
    name: seatIndex === 0 ? user.username : `Bot ${seatIndex}`,
    mainboard: [new Array(8).fill([]), new Array(8).fill([])], // organized draft picks
    sideboard: [new Array(8).fill([]), new Array(8).fill([])],
    pickorder: [],
    trashorder: [],
  }));

  return draft;
};

const checkPacks = (format: DraftFormat, seats: number, checkFn: CheckFn): CheckResult => {
  let ok = true;
  let messages: string[] = [];
  const result: CreatePacksResult = { ok, messages, initialState: [], cards: [] };
  for (let seat = 0; seat < seats; seat++) {
    result.initialState.push([]);
    for (let packNum = 0; packNum < format.packs.length; packNum++) {
      result.initialState[seat].push({ steps: [], cards: [] });
      const cards: Card[] = [];
      for (let cardNum = 0; cardNum < format.packs[packNum].slots.length; cardNum++) {
        const result = checkFn(format.packs[packNum].slots[cardNum].split(','));
        if (result.messages && result.messages.length > 0) {
          messages = messages.concat(result.messages);
        }
        if (!result.ok) {
          ok = false;
        }
      }

      result.initialState[seat][packNum] = {
        steps: format.packs[packNum].steps || [],
        cards: [],
      };

      for (const card of cards) {
        result.cards.push(card);
        result.initialState[seat][packNum].cards.push(result.cards.length - 1);
      }
    }
  }
  return result;
};

export const checkFormat = (format: DraftFormat, cards: Card[]): CheckResult => {
  // check that all filters are sane and match at least one card
  const checkFn: CheckFn = (cardFilters: string[]): CheckResult => {
    const messages: string[] = [];
    for (let i = 0; i < cardFilters.length; i++) {
      const filter = compileFilter(cardFilters[i]);
      const validCards = matchingCards(cards, filter);
      if (validCards.length === 0) {
        messages.push(`Warning: no cards matching filter: ${filter.filterText}`);
      }
    }
    if (messages.length > 0) {
      throw new Error(messages.join('\n'));
    }
    return { ok: messages.length === 0, messages };
  };

  return checkPacks(format, 1, checkFn);
};

const asfanPacks = (format: DraftFormat, seats: number, asfanFn: AsfanFn) => {
  for (let seat = 0; seat < seats; seat++) {
    for (let packNum = 0; packNum < format.packs.length; packNum++) {
      for (let cardNum = 0; cardNum < format.packs[packNum].slots.length; cardNum++) {
        asfanFn(format.packs[packNum].slots[cardNum].split(','));
      }
    }
  }
};

export const calculateAsfans = (cube: Cube, cards: Card[], draftFormat: number): { [key: string]: number } => {
  const cardsWithAsfan = cards.map((card) => ({ ...card, asfan: 0 }));
  const format = getDraftFormat({ id: draftFormat, packs: 3, cards: 15, players: 8 }, cube);

  if (cardsWithAsfan.length === 0) {
    throw new Error('Unable to create draft: no cards.');
  }

  const asfanFn = createAsfanFn(cardsWithAsfan, format.multiples);

  asfanPacks(format, 1, asfanFn);

  return fromEntries(cardsWithAsfan.map((card) => [card.cardID, card.asfan!]));
};
