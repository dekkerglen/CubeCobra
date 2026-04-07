import seedrandom from 'seedrandom';

import Card from '../datatypes/Card';
import Cube from '../datatypes/Cube';
import Draft, { CardSlot, DraftFormat, DraftState } from '../datatypes/Draft';
import User from '../datatypes/User';
import { buildDefaultSteps, createDefaultDraftFormat } from '../draftutil';
import { arraysEqual, fromEntries } from '../Util';
import { compileFilter, Filter } from './draftFilter';

type RNGFunction = () => number;

interface DraftParams {
  id: number;
  packs: number;
  cards?: number;
  players: number;
}

export interface DraftResult {
  card: Card | undefined;
  messages: string[];
}

export type NextCardFn = (cardFilters: string[], board?: string) => DraftResult;

interface AsfanResult {
  card: boolean;
  messages: string[];
}

type AsfanFn = (cardFilters: string[], board?: string) => AsfanResult;

export interface CreatePacksResult {
  ok: boolean;
  messages: string[];
  initialState: DraftState;
  cards: Card[];
}

interface CheckResult {
  ok: boolean;
  messages: string[];
}
type CheckFn = (cardFilters: string[], board?: string) => CheckResult;

const matchingCards = (cards: Card[], filter: Filter): Card[] => {
  // Implement the matchingCards function
  return cards.filter(filter.fn);
};

const createNextCardFn = (
  boardCards: Record<string, Card[]>,
  duplicates: boolean = false,
  rng: RNGFunction,
): NextCardFn => {
  // Track original board sizes to give better error messages
  const originalSizes: Record<string, number> = {};
  // Create mutable copies of each board's cards
  const pools: Record<string, Card[]> = {};
  for (const [board, cards] of Object.entries(boardCards)) {
    originalSizes[board] = cards.length;
    pools[board] = [...cards];
  }

  return (cardFilters: string[], board: string = 'mainboard'): DraftResult => {
    const cards = pools[board];
    if (!cards || cards.length === 0) {
      const originalSize = originalSizes[board] ?? 0;
      if (originalSize === 0) {
        throw new Error(`Unable to create draft: board "${board}" has no cards.`);
      }
      throw new Error(
        `Unable to create draft: ran out of cards in board "${board}" (started with ${originalSize}). ` +
          `Try adding more cards or reducing the number of players/packs.`,
      );
    }

    // each filter is an array of parsed filter tokens, we choose one randomly
    let validCards = cards;
    let index: number | null = null;
    const messages: string[] = [];
    if (cardFilters.length > 0) {
      do {
        index = Math.floor(rng() * cardFilters.length);
        const filterString = cardFilters[index];
        if (!filterString) {
          cardFilters.splice(index, 1);
          continue;
        }
        const filter = compileFilter(filterString);
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
      const originalSize = originalSizes[board] ?? 0;
      throw new Error(
        `Unable to create draft: no remaining cards in board "${board}" (${cards.length} of ${originalSize} left) match the slot filter.\n${messages.join('\n')}`,
      );
    }

    index = Math.floor(rng() * validCards.length);

    // slice out the first card with the index, or error out
    const card = validCards[index];
    if (!card) {
      throw new Error('Unable to create draft: selected card is undefined.');
    }

    if (!duplicates) {
      // remove from this board's pool
      const cardIdx = cards.indexOf(card);
      cards.splice(cardIdx, 1);

      // Global uniqueness: also remove from other boards' pools
      for (const [otherBoard, otherCards] of Object.entries(pools)) {
        if (otherBoard !== board) {
          const otherIdx = otherCards.indexOf(card);
          if (otherIdx >= 0) {
            otherCards.splice(otherIdx, 1);
          }
        }
      }
    }

    return { card, messages };
  };
};

const createAsfanFn = (boardCards: Record<string, Card[]>, duplicates: boolean = false): AsfanFn => {
  return (cardFilters: string[], board: string = 'mainboard'): AsfanResult => {
    const cards = boardCards[board];
    if (!cards || cards.length === 0) {
      throw new Error(`Unable to calculate asfan: board "${board}" has no cards.`);
    }

    // each filter is an array of parsed filter tokens, we choose one randomly
    const validCardGroups: Card[][] = [];
    const failedFilters: string[] = [];
    for (let i = 0; i < cardFilters.length; i++) {
      const filterString = cardFilters[i];
      if (!filterString) {
        continue;
      }
      const filter = compileFilter(filterString);
      let validCards = matchingCards(cards, filter);
      if (!duplicates) {
        validCards = validCards.filter((card) => (card.asfan || 0) < 1);
      }
      if (validCards.length > 0) {
        validCardGroups.push(validCards);
      } else {
        failedFilters.push(filter.filterText);
      }
    }

    if (validCardGroups.length === 0) {
      const filterInfo =
        failedFilters.length > 0
          ? `No cards in board "${board}" (${cards.length} cards) match the slot filter: ${failedFilters.join(', ')}`
          : `No cards in board "${board}" match the slot filter.`;
      throw new Error(`Unable to calculate asfan: ${filterInfo}`);
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
  /* Even if there is an draft ID, ensure that it exists in the cube. Relates to a bug
   * where deleting the custom draft format that was marked as default, didn't update the cube
   * back to not having a default format.
   */
  if (params.id >= 0 && cube.formats.at(params.id)) {
    const format = cube.formats[params.id];
    if (format) {
      return format;
    }
  }
  return createDefaultDraftFormat(params.packs, params.cards || 15);
};

type PackCreationCardSlot = {
  seat: number;
  packNum: number;
  cardNum: number;
  slotFilter: string[];
  board: string;
};

//Exporting for testing purposes
export const createPacks = (format: DraftFormat, seats: number, nextCardFn: NextCardFn): CreatePacksResult => {
  const cardsPerDrafter = format.packs.reduce(
    (accumulator, currentValue) => accumulator + currentValue.slots.length,
    0,
  );
  //In custom drafts the packs are not required to be the same size, thus using reduce rather than simple packs * pack size
  const totalCards = seats * cardsPerDrafter;

  const result: CreatePacksResult = {
    ok: true,
    messages: [],
    initialState: [],
    //Cards are no longer inserted in order of seat, pack, slot. Pre-allocate the array so we can splice in each card as found
    cards: new Array(totalCards),
  };

  /* Perform a two phase approach to creating packs. In the first phase all card slots with a filter
   * are performed, and then in the second phase the rest of the slots are done. This is to ensure that
   * the filtered slots across all packs/seats use the maximal set of cards that match their filter. Or in other
   * words, we don't want the non-filtered slots to consume cards that might match filtered card slots.
   */
  const filteredCardSlots: PackCreationCardSlot[] = [];
  const unfilteredCardSlots: PackCreationCardSlot[] = [];

  for (let seat = 0; seat < seats; seat++) {
    result.initialState.push([]);
    for (let packNum = 0; packNum < format.packs.length; packNum++) {
      const currentPack = format.packs[packNum];
      if (!currentPack) {
        continue;
      }

      result.initialState[seat]?.push({ steps: [], cards: [] });
      for (let cardNum = 0; cardNum < currentPack.slots.length; cardNum++) {
        const slotValue = currentPack.slots[cardNum];
        if (slotValue === undefined) {
          continue;
        }
        const filterStr = typeof slotValue === 'string' ? slotValue : (slotValue as CardSlot).filter || '';
        const slotBoard = typeof slotValue === 'string' ? 'mainboard' : (slotValue as CardSlot).board || 'mainboard';
        const slotFilter = filterStr.split(',');

        const slot: PackCreationCardSlot = {
          seat,
          packNum,
          cardNum,
          slotFilter,
          board: slotBoard,
        };

        const hasFilter = !(arraysEqual(slotFilter, ['']) || arraysEqual(slotFilter, ['*']));
        if (hasFilter) {
          filteredCardSlots.push(slot);
        } else {
          unfilteredCardSlots.push(slot);
        }
      }

      const seatState = result.initialState[seat];
      if (seatState) {
        seatState[packNum] = {
          //Will replace this after all the card slots in the pack have a card index
          steps: [],
          //Preallocate the space for all the card index numbers for this pack
          cards: Array(currentPack.slots.length),
        };
      }
    }
  }

  const cardsBeforeThisPack = (packNumber: number): number => {
    let sum = 0;
    for (let num = 0; num < packNumber; num++) {
      const pack = format.packs[num];
      if (pack) {
        sum += pack.slots.length;
      }
    }
    return sum;
  };

  let sumCardIndices = 0;
  for (const slot of [...filteredCardSlots, ...unfilteredCardSlots]) {
    const { seat, packNum, cardNum, slotFilter, board } = slot;

    const cardResult = nextCardFn(slotFilter, board);
    //FYI - The primary nextCardFn throws an Error if it cannot find a card for the filter, so result.messages won't matter
    if (cardResult.messages && cardResult.messages.length > 0) {
      result.messages = result.messages.concat(cardResult.messages);
    }
    if (cardResult.card) {
      //Determine where we slice this card in based on the original seat/pack/card in pack
      const cardIndex = seat * cardsPerDrafter + cardsBeforeThisPack(packNum) + cardNum;
      result.cards.splice(cardIndex, 1, cardResult.card);
      //Even though cards in the pack may not be set in array order, the end result is ordered from N to N+(pack length)
      //eg seat 0, pack 1 contains indices 15, 16, 17, through 24 for a standard 15 card pack
      const seatState = result.initialState[seat];
      const packState = seatState?.[packNum];
      if (packState) {
        packState.cards.splice(cardNum, 1, cardIndex);
      }
      sumCardIndices += cardIndex;
    } else {
      result.ok = false;
    }

    //Interestingly with pre-allocated size, using every(typeof currentValue !== "undefined") doesn't work because there are not actually items to execute the callback on!
    const seatState = result.initialState[seat];
    const packState = seatState?.[packNum];
    const allocatedCards = packState?.cards.filter((currentValue) => typeof currentValue !== 'undefined') || [];

    //All cards in the seat/pack are now initialized, as the set of defined card indices matches the pack's length
    const currentPack = format.packs[packNum];
    const currentPackState = result.initialState[seat]?.[packNum];
    if (currentPack && currentPackState && allocatedCards.length === currentPack.slots.length) {
      currentPackState.steps = currentPack.steps || buildDefaultSteps(currentPackState.cards.length);
    }
  }

  //Final assertions - These should never fail unless something has disasterously gone wrong

  //The card indices across all packs should be 0 through totalCards-1. The sum of N consecutive integers (starting from zero) is N*(N-1)/2
  const expectedSumCardIndices = (totalCards * (totalCards - 1)) / 2;
  if (sumCardIndices !== expectedSumCardIndices) {
    result.messages = result.messages.concat('Unexpected number of cards');
    result.ok = false;
  }

  //Also every pack should have all slots initialized, none left with undefined from pre-allocation
  const countDefinedPicks = result.initialState.flatMap((seat) =>
    seat.flatMap((pack) => pack.cards.filter((i) => typeof i !== 'undefined')),
  ).length;
  if (countDefinedPicks !== totalCards) {
    result.messages = result.messages.concat('Some pack slots did not get a card unexpectedly');
    result.ok = false;
  }

  return result;
};

export const createDraft = (
  cube: Cube,
  format: DraftFormat,
  cubeCards: Card[] | Record<string, Card[]>,
  seats: number,
  user?: User,
  seed: string | false = false,
): Draft => {
  if (!seed) {
    seed = Date.now().toString();
  }
  const rng = seedrandom(seed);

  // Normalize cubeCards to Record<string, Card[]> for multi-board support
  // If passed as Card[] (backwards compat), treat as mainboard
  const boardCards: Record<string, Card[]> = Array.isArray(cubeCards) ? { mainboard: cubeCards } : cubeCards;

  // Check that at least one board has cards
  const totalCards = Object.values(boardCards).reduce((sum, cards) => sum + cards.length, 0);
  if (totalCards === 0) {
    throw new Error('Unable to create draft: no cards.');
  }

  let nextCardFn: NextCardFn | null = null;
  nextCardFn = createNextCardFn(boardCards, format.multiples, rng);

  //TODO: Add the endpack steps here instead of in frontend
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
    basics: [], // Deprecated - for backwards compatibility
    // basicsBoard stores a display name (e.g. "Basics"); it is normalized
    // via boardNameToKey() at lookup time in getBasicsFromCube()
    basicsBoard: format.basicsBoard || 'Basics',
    id: '',
    type: 'd',
    owner: user?.id,
    cubeOwner: cube.owner,
    date: new Date(),
    name: '',
    complete: false,
  };

  draft.seats = draft.InitialState!.map((_, seatIndex) => ({
    bot: seatIndex !== 0,
    owner: seatIndex === 0 ? user?.id : '',
    name: seatIndex === 0 ? user?.username : `Bot ${seatIndex}`,
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
      const currentPack = format.packs[packNum];
      if (!currentPack) {
        continue;
      }

      result.initialState[seat]?.push({ steps: [], cards: [] });
      const cards: Card[] = [];
      for (let cardNum = 0; cardNum < currentPack.slots.length; cardNum++) {
        const slotValue = currentPack.slots[cardNum];
        if (!slotValue) {
          continue;
        }
        const filterStr = typeof slotValue === 'string' ? slotValue : (slotValue as CardSlot).filter || '';
        const slotBoard = typeof slotValue === 'string' ? 'mainboard' : (slotValue as CardSlot).board || 'mainboard';
        const result = checkFn(filterStr.split(','), slotBoard);
        if (result.messages && result.messages.length > 0) {
          messages = messages.concat(result.messages);
        }
        if (!result.ok) {
          ok = false;
        }
      }

      const seatState = result.initialState[seat];
      if (seatState && seatState[packNum]) {
        seatState[packNum] = {
          steps: currentPack.steps || [],
          cards: [],
        };

        for (const card of cards) {
          result.cards.push(card);
          seatState[packNum]?.cards.push(result.cards.length - 1);
        }
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
      const filterString = cardFilters[i];
      if (!filterString) {
        continue;
      }
      const filter = compileFilter(filterString);
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
      const currentPack = format.packs[packNum];
      if (!currentPack) {
        continue;
      }
      for (let cardNum = 0; cardNum < currentPack.slots.length; cardNum++) {
        const slotValue = currentPack.slots[cardNum];
        if (!slotValue) {
          continue;
        }
        const filterStr = typeof slotValue === 'string' ? slotValue : (slotValue as CardSlot).filter || '';
        const slotBoard = typeof slotValue === 'string' ? 'mainboard' : (slotValue as CardSlot).board || 'mainboard';
        asfanFn(filterStr.split(','), slotBoard);
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

  const boardCards: Record<string, Card[]> = { mainboard: cardsWithAsfan };
  const asfanFn = createAsfanFn(boardCards, format.multiples);

  asfanPacks(format, 1, asfanFn);

  return fromEntries(cardsWithAsfan.map((card) => [card.cardID, card.asfan!]));
};
