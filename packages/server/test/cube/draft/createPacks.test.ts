import { DraftFormat, DraftState, Pack } from '@utils/datatypes/Draft';
import { createPacks, CreatePacksResult, DraftResult, NextCardFn } from '@utils/drafting/createdraft';
import { buildDefaultSteps, createDefaultDraftFormat } from '@utils/draftutil';
import seedrandom from 'seedrandom';

describe('createPacks', () => {
  beforeEach(() => {
    cardId = 1;

    cubeCardIndicesByFilter = structuredClone(mockCardIndicesByFilter);
  });

  it('standard picks', async () => {
    const expectedCards = 1 * 5 * 2;
    const result = createPacks(mockSmallOnePackDraft, 2, mockUniqueCardGenerator);

    assertSuccessfulPackCreation(result, expectedCards);
  });

  it('fail if cards cannot be found', async () => {
    const cardGenerator: NextCardFn = (): DraftResult => {
      return {
        card: undefined,
        messages: ['Not enough cards'],
      };
    };

    const result = createPacks(mockSmallOnePackDraft, 2, cardGenerator);

    expect(result.ok).toBeFalsy();
    expect(result.cards.filter((c) => typeof c !== 'undefined')).toHaveLength(0);
    expect(result.messages).toContain('Not enough cards');
  });

  it('fail if any card cannot be found', async () => {
    let index = 0;
    //All but one card is successful found for a card slot in packs
    const cardGenerator: NextCardFn = (): DraftResult => {
      if (index === 7) {
        index += 1;
        return {
          card: undefined,
          messages: ['Not enough cards'],
        };
      }

      const card = {
        card: {
          cardID: `${index}-${index}`,
        },
        messages: [],
      };
      index += 1;
      return card;
    };

    const result = createPacks(mockSmallOnePackDraft, 2, cardGenerator);

    expect(result.ok).toBeFalsy();
    expect(result.cards.filter((c) => typeof c !== 'undefined')).toHaveLength(9);
    expect(result.messages).toContain('Not enough cards');
  });

  it('Standard picks and draft size, randomized cards', async () => {
    const expectedCardCount = 3 * 15 * 8;

    const result = createPacks(mockStandardDraft, 8, getRandomizedCardGenerator(expectedCardCount));

    assertSuccessfulPackCreation(result, expectedCardCount);
  });

  it('Custom draft with unique card counts per pack', async () => {
    const numberOfDrafters = 3;
    const cardsPerDrafter = 5 + 8 + 3 + 2;
    const expectedCardCount = cardsPerDrafter * numberOfDrafters;

    const format: DraftFormat = {
      title: 'Custom',
      packs: [
        createUnfilteredPackOfSize(5),
        createUnfilteredPackOfSize(8),
        createUnfilteredPackOfSize(3),
        createUnfilteredPackOfSize(2),
      ],
      multiples: false,
      defaultSeats: 4,
    };

    const result = createPacks(format, numberOfDrafters, mockUniqueCardGenerator);

    assertSuccessfulPackCreation(result, expectedCardCount);
  });

  it('Custom draft with all cards filtered', async () => {
    const numberOfDrafters = 5;
    const cardsPerDrafter = 11 + 6;
    const expectedCardCount = cardsPerDrafter * numberOfDrafters;

    const format: DraftFormat = {
      title: 'Custom',
      packs: [createFilteredPackOfSize(11, 'r:mythic'), createFilteredPackOfSize(6, 'set:inv')],
      multiples: false,
      defaultSeats: 4,
    };

    //The filtering doesn't actually occur in this test because mockUniqueCardGenerator doesn't care
    const result = createPacks(format, numberOfDrafters, mockUniqueCardGenerator);

    assertSuccessfulPackCreation(result, expectedCardCount);
  });

  it('Custom draft some cards filtered', async () => {
    const numberOfDrafters = 6;
    const cardsPerDrafter = 15 + 5;
    const expectedCardCount = cardsPerDrafter * numberOfDrafters;

    const format: DraftFormat = {
      title: 'Custom',
      packs: [createUnfilteredPackOfSize(15), createFilteredPackOfSize(5, 'rarity:mythic')],
      multiples: false,
      defaultSeats: 4,
    };

    //Again filtering doesn't actually occur, but the filtered slots will be done BEFORE the unfiltered
    const result = createPacks(format, numberOfDrafters, mockUniqueCardGenerator);

    assertSuccessfulPackCreation(result, expectedCardCount);
  });

  it('Custom draft where unfiltered do not consume filtered cards', async () => {
    const expectedCardCount = mockFilteredDraftState.cardsPerDrafter * mockFilteredDraftState.numberOfDrafters;

    /* To not have randomness, we will predefine which filter groups of cards are picked for unfiltered cards. Based on
     * cubeCardIdsByFilter we have 2 extra rares and 4 floaters (cards not matching any filter)
     */
    const orderOfUnfilteredCardGrabbing = ['', '', '', 'rarity:rare', '', 'rarity:rare'];

    const result = createPacks(
      mockFilteredDraftState.format,
      mockFilteredDraftState.numberOfDrafters,
      getFilteredCardGenerator(orderOfUnfilteredCardGrabbing),
    );
    assertSuccessfulPackCreation(result, expectedCardCount);
  });

  it('Custom draft with verified card slots match filters', async () => {
    //Override cube cards, with 14 total cards
    //2 drafters and in 1 pack means each filter needs 2 cards
    cubeCardIndicesByFilter = {
      'rarity:mythic': [5, 9],
      'rarity:rare': [2, 6],
      'set:inv': [1, 13],
      'tag:alpha': [4, 8],
      'tag:beta': [11, 7],
      'tag:delta': [10, 0],
      'tag:kappa': [12, 3],
    };
    //Because getFilteredCardGenerator mutates cubeCardIndicesByFilter, have a copy so we can assert on it after
    const cubeCardIndicesByFilterClone = structuredClone(cubeCardIndicesByFilter);

    const filteredDraftState = {
      format: {
        title: 'Custom',
        packs: [
          {
            slots: ['rarity:mythic', 'rarity:rare', 'set:inv'],
            steps: buildDefaultSteps(3),
          },
          {
            slots: ['tag:alpha', 'tag:beta', 'tag:delta', 'tag:kappa'],
            steps: buildDefaultSteps(3),
          },
        ],
        multiples: false,
        defaultSeats: 4,
      } as DraftFormat,
      numberOfDrafters: 2,
      cardsPerDrafter: 7,
    };

    const result = createPacks(
      filteredDraftState.format,
      filteredDraftState.numberOfDrafters,
      getFilteredCardGenerator([]),
    );
    assertSuccessfulPackCreation(result, filteredDraftState.cardsPerDrafter * filteredDraftState.numberOfDrafters);

    const initialState = result.initialState;

    const assertCardSlotMatchFilter = (filteredCardSet: number[], cardIndex: number) => {
      const cardId = result.cards[cardIndex]!;
      //Convert the card indices to ids just like we do in getFilteredCardGenerator
      expect(filteredCardSet.map((id) => `${id}-${id}`)).toContain(cardId.cardID);
    };

    //Assert the card packs for each set have cards matching the filters in order
    for (let seat = 0; seat < initialState.length; seat++) {
      //Pack 1
      assertCardSlotMatchFilter(cubeCardIndicesByFilterClone['rarity:mythic']!, initialState[seat]![0]!.cards[0]!);
      assertCardSlotMatchFilter(cubeCardIndicesByFilterClone['rarity:rare']!, initialState[seat]![0]!.cards[1]!);
      assertCardSlotMatchFilter(cubeCardIndicesByFilterClone['set:inv']!, initialState[seat]![0]!.cards[2]!);

      //Pack 2
      assertCardSlotMatchFilter(cubeCardIndicesByFilterClone['tag:alpha']!, initialState[seat]![1]!.cards[0]!);
      assertCardSlotMatchFilter(cubeCardIndicesByFilterClone['tag:beta']!, initialState[seat]![1]!.cards[1]!);
      assertCardSlotMatchFilter(cubeCardIndicesByFilterClone['tag:delta']!, initialState[seat]![1]!.cards[2]!);
      assertCardSlotMatchFilter(cubeCardIndicesByFilterClone['tag:kappa']!, initialState[seat]![1]!.cards[3]!);
    }
  });

  it('Custom draft filtered slots run out', async () => {
    cubeCardIndicesByFilter = {
      'rarity:mythic': [3, 7, 17, 29, 14], //1 mythic less than needed
      'rarity:rare': [11, 16, 22, 21, 20, 18], //Exact number of rares needed
      'rarity:uncommon': [0, 1, 2, 28, 27, 26, 25, 6, 9, 10, 12, 13], //2 uncommon slots so need 12
      '': [19, 15, 4, 23, 24, 5, 8], //Extra cards not matching filters
    };

    /* To not have randomness, we will predefine which filter groups of cards are picked for unfiltered cards. These
     * pick from the unfiltered group so there is no failure overlap with missing mythic/rare
     */
    const orderOfUnfilteredCardGrabbing = ['', '', '', '', '', '', ''];

    const result = createPacks(
      mockFilteredDraftState.format,
      mockFilteredDraftState.numberOfDrafters,
      getFilteredCardGenerator(orderOfUnfilteredCardGrabbing),
    );
    expect(result.ok).toBeFalsy();
    //The 1 mythic slot is missing
    expect(result.cards.filter((c) => typeof c !== 'undefined')).toHaveLength(29);
    expect(result.messages).toContain('No cards remaining that match filter');
  });

  //In general this test is equivalent to a filtered slot not matching a card, or the cube having less cards than needed for the draft
  it('Custom draft where unfiltered slots run out', async () => {
    /* To not have randomness, we will predefine which filter groups of cards are picked for unfiltered cards. Based on
     * cubeCardIdsByFilter we have 2 extra rares and 4 floaters (cards not matching any filter), so trying to consume a mythic or uncommon
     * when those sets of cards are used up means we expect failure due to missing cards
     */
    const orderOfUnfilteredCardGrabbing = ['', '', '', 'rarity:mythic', '', 'rarity:uncommon'];

    const result = createPacks(
      mockFilteredDraftState.format,
      mockFilteredDraftState.numberOfDrafters,
      getFilteredCardGenerator(orderOfUnfilteredCardGrabbing),
    );
    expect(result.ok).toBeFalsy();
    //The two slots for mythic and uncommon in orderOfUnfilteredCardGrabbing will find no card, so 2 of 30 cards will not be set.
    expect(result.cards.filter((c) => typeof c !== 'undefined')).toHaveLength(28);
    expect(result.messages).toContain('No cards remaining');
  });

  it('For a sample pack (one person, one pack)', async () => {
    const expectedCardCount = 1 * 15 * 1;

    //Sample packs can use a custom draft format (if it is set as the cube's default), but that doesn't change much about this test
    const result = createPacks(createDefaultDraftFormat(1, 15), 1, getRandomizedCardGenerator(expectedCardCount));

    assertSuccessfulPackCreation(result, expectedCardCount);
  });
});

/************************/
//Test helpers
/************************/

const mockStandardDraft = createDefaultDraftFormat(3, 15);
const mockSmallOnePackDraft = createDefaultDraftFormat(1, 5); //1 pack of 5 cards per player

//Helper that generates unique cards (which just happen to have sequential card id instead of guids)
let cardId = 1;
const mockUniqueCardGenerator: NextCardFn = (): DraftResult => {
  const card = {
    card: {
      cardID: `${cardId}-${cardId}`,
    },
    messages: [],
  };
  cardId += 1;
  return card;
};

/*
 * Even though cards in the cube are randomized into CreatePacksResult.cards, in the DraftState the
 * packs by seat, pack, then card should be a sequence of 0 to the number of cards in the draft
 */
const assertPackIndexSequence = (draftState: DraftState) => {
  let expectedIndex = 0; //Starts at zero
  for (let seat = 0; seat < draftState.length; seat++) {
    for (let packNum = 0; packNum < draftState[seat]!.length; packNum++) {
      for (let cardNum = 0; cardNum < draftState[seat]![packNum]!.cards.length; cardNum++) {
        const cardIndex = draftState[seat]![packNum]!.cards[cardNum]!;
        if (cardIndex !== expectedIndex) {
          fail(
            `For seat ${seat}, pack ${packNum}, the ${cardNum}th card is an unexpected index ${cardIndex}, should have been ${expectedIndex}`,
          );
        }
        expectedIndex += 1;
      }
    }
  }

  return true;
};

const assertSuccessfulPackCreation = (result: CreatePacksResult, expectedCardCount: number) => {
  const validCards = result.cards.filter((c) => typeof c !== 'undefined');
  expect(result.ok).toBeTruthy();
  expect(validCards).toHaveLength(expectedCardCount);
  //Also expect all the cards to have unique ids (in this test; the card generator can allow duplicates)
  expect(new Set(validCards.map((c) => c.cardID)).size).toEqual(expectedCardCount);
  expect(result.messages).toHaveLength(0);
  assertPackIndexSequence(result.initialState);
};

const getRandomizedCardGenerator = (expectedCardCount: number): (() => DraftResult) => {
  //Force the seed so that any tests using this are consistent
  const rng = seedrandom('1738241555');

  const validCardIds: number[] = [];
  for (let i = 0; i < expectedCardCount; i++) {
    validCardIds.push(i);
  }

  return (): DraftResult => {
    const index = Math.floor(rng() * validCardIds.length);

    // slice out the first card with the index, or error out
    const cardId = validCardIds[index];
    validCardIds.splice(index, 1);

    return {
      card: {
        cardID: `${cardId}-${cardId}`,
      },
      messages: [],
    };
  };
};

const createUnfilteredPackOfSize = (numberOfCards: number): Pack => {
  return {
    slots: Array.from({ length: numberOfCards }, () => '*'),
    steps: buildDefaultSteps(numberOfCards),
  };
};

const createFilteredPackOfSize = (numberOfCards: number, filter: string): Pack => {
  return {
    slots: Array.from({ length: numberOfCards }, () => filter),
    steps: buildDefaultSteps(numberOfCards),
  };
};

/* Card indices were randomly generated by typing (from a set of 0 to 29, assuming 30 cards are needed).
 * The card generator returns the index of the card chosen (matching the filters if any) from the randomized card set (which is baked
 * into the generator)
 */
const mockCardIndicesByFilter = {
  'rarity:mythic': [3, 7, 4, 17, 29, 14], //3 drafters and 2 packs, so need at least 6 mythics
  'rarity:rare': [11, 16, 22, 21, 20, 18, 5, 8], //Have some extra rares
  'rarity:uncommon': [0, 1, 2, 28, 27, 26, 25, 6, 9, 10, 12, 13], //2 uncommon slots so need 12
  '': [19, 15, 23, 24], //Extra cards not matching filters
};

//Mock draft state for tests using filtered card slots
const mockFilteredDraftState = {
  format: {
    title: 'Custom',
    packs: [
      {
        slots: ['rarity:mythic', 'rarity:rare', 'rarity:uncommon', 'rarity:uncommon', '*'],
        steps: buildDefaultSteps(5),
      },
      {
        slots: ['rarity:mythic', '', 'rarity:rare', 'rarity:uncommon', 'rarity:uncommon'],
        steps: buildDefaultSteps(5),
      },
    ],
    multiples: false,
    defaultSeats: 4,
  } as DraftFormat,
  numberOfDrafters: 3,
  cardsPerDrafter: 10,
};

//Card ids are random (from a set of 0 to expectedCardCount-1)
let cubeCardIndicesByFilter: Record<string, number[]>;

/* This function mimics finding cube cards using filters, using rarity as the placeholder filters. Returns cards
 * in order from the filter sets for simplicity
 */
const getFilteredCardGenerator = (orderOfUnfilteredCardGrabbing: string[]) => {
  return (cardFilters: string[]): DraftResult => {
    /* A card slot can have multiple comma separated filters, which are randomly chosen from in the normal generation.
     * We don't care about this in this pack creation test
     */
    let cardFilterString = cardFilters.join('');

    //* and empty filter are equivalent
    if (cardFilterString === '*') {
      cardFilterString = '';
    }

    let cardSet: number[];
    //For unfiltered, randomly choose from the overall set of cards from any filter group that is not empty of cards
    if (cardFilterString === '') {
      const nextUnfilteredCardGroupToPickFrom = orderOfUnfilteredCardGrabbing[0]!;
      //Remove the group from the set
      orderOfUnfilteredCardGrabbing.splice(0, 1);

      cardSet = cubeCardIndicesByFilter[nextUnfilteredCardGroupToPickFrom]!;
      if (cardSet.length === 0) {
        return {
          card: undefined,
          messages: ['No cards remaining'],
        };
      }
    } else {
      cardSet = cubeCardIndicesByFilter[cardFilterString]!;
      if (cardSet.length === 0) {
        return {
          card: undefined,
          messages: ['No cards remaining that match filter'],
        };
      }
    }

    //For simplicity grab cards from each set in order
    const cardId = cardSet[0];
    //Remove card from set
    cardSet.splice(0, 1);

    return {
      card: {
        cardID: `${cardId}-${cardId}`,
      },
      messages: [],
    };
  };
};
