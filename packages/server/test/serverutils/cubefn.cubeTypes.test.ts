import { LegalityFormats } from '@utils/datatypes/Card';
import { cardFromId, getAllVersionIds } from 'serverutils/carddb';
import { getCubeTypes } from 'serverutils/cubefn';

import { createCardDetails } from '../test-utils/data';

jest.mock('serverutils/carddb');

const mockCardFromId = cardFromId as jest.MockedFunction<typeof cardFromId>;
const mockGetAllVersionIds = getAllVersionIds as jest.MockedFunction<typeof getAllVersionIds>;

// A card is "legal" in every format down to and including the given one.
// Vintage is the least restrictive format, Standard the most.
const FORMAT_RANK: LegalityFormats[] = ['Vintage', 'Legacy', 'Modern', 'Pioneer', 'Standard'];

const legalitiesFor = (mostRestrictive: LegalityFormats | null) => {
  const maxIndex = mostRestrictive === null ? -1 : FORMAT_RANK.indexOf(mostRestrictive);
  return Object.fromEntries(
    FORMAT_RANK.map((format, index) => [format, index <= maxIndex ? ('legal' as const) : ('not_legal' as const)]),
  );
};

const cubeCardLegalIn = (cardID: string, mostRestrictive: LegalityFormats | null) => {
  mockCardFromId.mockImplementation((id) =>
    createCardDetails({
      scryfall_id: id,
      legalities: { ...legalitiesFor(mostRestrictive), Pauper: 'not_legal' },
    }),
  );
  return { cardID, status: 'Not Owned', cmc: 1, tags: [], colors: [] };
};

const cubeCard = (cardID: string) => ({ cardID, status: 'Not Owned', cmc: 1, tags: [], colors: [] });

// The tightest format the cube fits in: eligibleFormats runs least to most
// restrictive, so that is its last entry.
const tightestFormat = (eligibleFormats: string[]) => eligibleFormats[eligibleFormats.length - 1];

describe('getCubeTypes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllVersionIds.mockReturnValue([]);
  });

  it.each([
    ['Standard', ['Vintage', 'Legacy', 'Modern', 'Pioneer', 'Standard']],
    ['Pioneer', ['Vintage', 'Legacy', 'Modern', 'Pioneer']],
    ['Modern', ['Vintage', 'Legacy', 'Modern']],
    ['Legacy', ['Vintage', 'Legacy']],
    [null, ['Vintage']],
  ])('classifies a cube whose most restrictive legal format is %s', (mostRestrictive, expected) => {
    const card = cubeCardLegalIn('card1', mostRestrictive as LegalityFormats | null);

    const { eligibleFormats } = getCubeTypes([card]);

    expect(eligibleFormats).toEqual(expected);
    expect(tightestFormat(eligibleFormats)).toEqual(mostRestrictive === null ? 'Vintage' : mostRestrictive);
  });

  it('uses the most restrictive format shared by every card in the cube', () => {
    mockCardFromId.mockImplementation((id) => {
      const legalUpTo: Record<string, LegalityFormats | null> = {
        standardCard: 'Standard',
        modernCard: 'Modern',
        vintageCard: null,
      };
      return createCardDetails({
        scryfall_id: id,
        legalities: { ...legalitiesFor(legalUpTo[id] ?? null), Pauper: 'not_legal' },
      });
    });

    const cards = ['standardCard', 'modernCard'].map((cardID) => ({
      cardID,
      status: 'Not Owned',
      cmc: 1,
      tags: [],
      colors: [],
    }));

    expect(tightestFormat(getCubeTypes(cards).eligibleFormats)).toEqual('Modern');
  });

  // Vintage is the catch-all: a cube that qualifies for no tighter format
  // lands there, so power, custom cards, and un-cards all resolve to Vintage.
  it('treats a cube of restricted and banned cards as Vintage', () => {
    // Mox Jet: restricted in Vintage, banned everywhere it appears below it.
    mockCardFromId.mockImplementation((id) =>
      createCardDetails({
        scryfall_id: id,
        legalities: {
          Standard: 'not_legal',
          Pioneer: 'not_legal',
          Modern: 'not_legal',
          Legacy: 'banned',
          Vintage: 'restricted',
          Pauper: 'not_legal',
        },
      }),
    );

    const { eligibleFormats } = getCubeTypes([cubeCard('moxJet')]);

    expect(tightestFormat(eligibleFormats)).toEqual('Vintage');
    expect(eligibleFormats).toEqual(['Vintage']);
  });

  // Legality does not nest. Deathrite Shaman is playable in Pioneer but banned
  // in the wider Modern and Legacy, so Modern must not be inferred from it.
  it('skips a wider format the cube is ineligible for', () => {
    mockCardFromId.mockImplementation((id) =>
      createCardDetails({
        scryfall_id: id,
        legalities: {
          Standard: 'not_legal',
          Pioneer: 'legal',
          Modern: 'banned',
          Legacy: 'banned',
          Vintage: 'legal',
          Pauper: 'not_legal',
        },
      }),
    );

    const { eligibleFormats } = getCubeTypes([cubeCard('deathriteShaman')]);

    expect(tightestFormat(eligibleFormats)).toEqual('Pioneer');
    expect(eligibleFormats).toEqual(['Vintage', 'Pioneer']);
  });

  // Geological Appraiser is playable in Standard but banned in the wider
  // Pioneer, so a Standard cube is not automatically a Pioneer cube.
  it('does not assume a Standard cube is Pioneer eligible', () => {
    mockCardFromId.mockImplementation((id) =>
      createCardDetails({
        scryfall_id: id,
        legalities: {
          Standard: 'legal',
          Pioneer: 'banned',
          Modern: 'legal',
          Legacy: 'legal',
          Vintage: 'legal',
          Pauper: 'not_legal',
        },
      }),
    );

    const { eligibleFormats } = getCubeTypes([cubeCard('geologicalAppraiser')]);

    expect(tightestFormat(eligibleFormats)).toEqual('Standard');
    expect(eligibleFormats).toEqual(['Vintage', 'Legacy', 'Modern', 'Standard']);
  });

  it('reports every format the cube is eligible for', () => {
    const card = cubeCardLegalIn('card1', 'Modern');

    const { eligibleFormats } = getCubeTypes([card]);

    expect(eligibleFormats).toEqual(['Vintage', 'Legacy', 'Modern']);
  });
});
