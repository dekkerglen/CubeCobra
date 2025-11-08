import { FilterResult, makeFilter } from '../../src/client/filtering/FilterCards';
import Card, { SUPPORTED_FORMATS } from '../../src/datatypes/Card';
import { createCard, createCardDetails } from '../test-utils/data';

describe('Name filter syntax', () => {
  const assertValidNameFilter = (result: FilterResult) => {
    expect(result.err).toBeFalsy();
    expect(result.filter).toBeInstanceOf(Function);
    expect(result.filter?.fieldsUsed).toEqual(['name_lower']);
  };

  it('Empty filter is no filtering', async () => {
    const result = makeFilter('');
    expect(result.err).toBeFalsy();
    expect(result.filter).toBeNull();

    const result2 = makeFilter('     ');
    expect(result2.err).toBeFalsy();
    expect(result2.filter).toBeNull();
  });

  it('Default filter is card name', async () => {
    assertValidNameFilter(makeFilter('Urza'));
    assertValidNameFilter(makeFilter('"Armageddon"'));
    assertValidNameFilter(makeFilter("'Goblin Welder'"));
  });

  it('Negative name filter', async () => {
    assertValidNameFilter(makeFilter('-mox'));
    assertValidNameFilter(makeFilter('-"Diamond"'));
    assertValidNameFilter(makeFilter("-'Dockside Chef'"));
  });

  it('Explicit name filter', async () => {
    assertValidNameFilter(makeFilter('name:Blood'));
    assertValidNameFilter(makeFilter('name:"Caustic Bro"'));
    assertValidNameFilter(makeFilter("name:'The Meathook Mass'"));
  });

  it('Short explicit name filter', async () => {
    assertValidNameFilter(makeFilter('n:Master of Death'));
    assertValidNameFilter(makeFilter('n:"Abrupt Decay"'));
    assertValidNameFilter(makeFilter("n:'March of Otherworldly Light'"));
  });

  it('Exact name filter', async () => {
    assertValidNameFilter(makeFilter('name=Bloodghast'));
    assertValidNameFilter(makeFilter('name="Caustic Bronco"'));
    assertValidNameFilter(makeFilter("name='The Meathook Massacre'"));
  });

  it('Not exact name filter', async () => {
    assertValidNameFilter(makeFilter('name!=Bloodghast'));
    assertValidNameFilter(makeFilter('name!="Caustic Bronco"'));
    assertValidNameFilter(makeFilter("name!='The Meathook Massacre'"));

    assertValidNameFilter(makeFilter('name<>Bloodghast'));
    assertValidNameFilter(makeFilter('name<>"Caustic Bronco"'));
    assertValidNameFilter(makeFilter("name<>'The Meathook Massacre'"));
  });

  it('Combination name filters', async () => {
    assertValidNameFilter(makeFilter('Dragon or angel'));
    assertValidNameFilter(makeFilter('dragon AND orb'));
    assertValidNameFilter(makeFilter('-Dragon AND rage'));
    assertValidNameFilter(makeFilter('-Dragon or rage'));
  });

  const workingNamesWithInterestingCharacters = [
    'Chatterfang, Squirrel',
    'Oni-Cult Anvil',
    'Busted!',
    '+2 mace',
    'Mr. Orfeo, the Boulder',
    'Borrowing 100,000 Arrows',
    'TL;DR',
    'Question Elemental?',
    '_____ Goblin',
    'The Ultimate Nightmare of Wizards of the Coast® Customer Service',
    'Ratonhnhaké꞉ton',
  ];

  it.each(workingNamesWithInterestingCharacters)('Working names with interesting characters (%s)', async (name) => {
    assertValidNameFilter(makeFilter(name));
    assertValidNameFilter(makeFilter(`'${name}'`));
    assertValidNameFilter(makeFilter(`"${name}"`));
    assertValidNameFilter(makeFilter(`name:'${name}'`));
    assertValidNameFilter(makeFilter(`name:"${name}"`));
  });

  it('Partial working names with single quotes', async () => {
    const name = "Urza's Bauble";
    assertValidNameFilter(makeFilter(name));
    assertValidNameFilter(makeFilter(`"${name}"`));
    assertValidNameFilter(makeFilter(`name:"${name}"`));

    //Cannot single-quote surround a name containing a single quote
    const result = makeFilter(`'${name}'`);
    expect(result.err).toBeTruthy();
    const result2 = makeFilter(`name:'${name}'`);
    expect(result2.err).toBeTruthy();

    //But it does work if the quote is escaped
    assertValidNameFilter(makeFilter(`'Urza\\'s Bauble'`));
    assertValidNameFilter(makeFilter(`n:'Urza\\'s Bauble'`));
  });

  it('Partial working names with double quotes', async () => {
    const name = 'Kongming, "Sleeping Dragon"';
    assertValidNameFilter(makeFilter(name));
    assertValidNameFilter(makeFilter(`'${name}'`));
    assertValidNameFilter(makeFilter(`name:'${name}'`));

    //Cannot double-quote surround a name containing a double quote
    const result = makeFilter(`"${name}"`);
    expect(result.err).toBeTruthy();
    const result2 = makeFilter(`name:"${name}"`);
    expect(result2.err).toBeTruthy();

    //But it does work if the quote is escaped
    assertValidNameFilter(makeFilter(`"Kongming, \\"Sleeping Dragon\\""`));
    assertValidNameFilter(makeFilter(`n:'Urza\\'s Bauble'`));
  });

  const failingNamesWithInterestingCharacters = [
    'Hazmat Suit (Used)', //The brackets get interpreted as another clause and we only want a single filter
  ];

  it.each(failingNamesWithInterestingCharacters)('Failing names with interesting characters (%s)', async (name) => {
    const result = makeFilter(name);
    expect(result.err).toBeTruthy();
  });
});

describe('Tag filter syntax', () => {
  const assertValidTagFilter = (result: FilterResult) => {
    expect(result.err).toBeFalsy();
    expect(result.filter).toBeInstanceOf(Function);
    expect(result.filter?.fieldsUsed).toEqual(['tags']);
  };

  const assertInvalidTagFilter = (result: FilterResult) => {
    expect(result.err).toBeTruthy();
  };

  it('Tag contents filter operations', async () => {
    //Partial matching
    assertValidTagFilter(makeFilter('tag:fetch'));
    assertValidTagFilter(makeFilter('tags:fetch'));

    //Exact matching
    assertValidTagFilter(makeFilter('tag:"fetch"'));
    assertValidTagFilter(makeFilter("tags:'fetch'"));
  });

  it('Tag count filter operations', async () => {
    //All filters based on the number of tags
    assertValidTagFilter(makeFilter('tag=3'));
    assertValidTagFilter(makeFilter('tag!=3'));
    assertValidTagFilter(makeFilter('tag<>3'));
    assertValidTagFilter(makeFilter('tag>0'));
    assertValidTagFilter(makeFilter('tag>=0'));
    assertValidTagFilter(makeFilter('tag<2'));
    assertValidTagFilter(makeFilter('tag<=1'));
  });

  it('Tag contents invalid filters', async () => {
    //At this time Tag= either needs to be a single/double quoted string, or be a number.
    //To allow this form would require very tricky nearley grammar since numbers are also strings (eg both branches would match)
    assertInvalidTagFilter(makeFilter('tag=fetch'));
    assertInvalidTagFilter(makeFilter('tags=foo'));
    assertInvalidTagFilter(makeFilter('tag="fetch"'));
    assertInvalidTagFilter(makeFilter('tags="foo"'));
    assertInvalidTagFilter(makeFilter("tag='fetch'"));
    assertInvalidTagFilter(makeFilter("tags='foo'"));
  });

  const getDeckWithTags = (): Card[] => {
    const deck: Card[] = [];

    deck.push(
      createCard({
        cardID: '00001234',
        tags: [],
        details: createCardDetails({
          name_lower: 'badlands',
        }),
      }),
    );
    deck.push(
      createCard({
        cardID: '00001235',
        tags: ['Fetch lands', 'Tarkir'].map((v) => v.toLowerCase()),
        details: createCardDetails({
          name_lower: 'windswept heath',
        }),
      }),
    );
    deck.push(
      createCard({
        cardID: '00001345',
        tags: ['Combo', 'Counters'],
        details: createCardDetails({
          name_lower: 'hardened scales',
        }),
      }),
    );
    deck.push(
      createCard({
        cardID: '00001522',
        tags: ['Fetchable', 'Grixis'],
        details: createCardDetails({
          name_lower: 'xanders lounge',
        }),
      }),
    );
    deck.push(
      createCard({
        cardID: '00001577',
        tags: ['Unreliable', 'Fetchable'],
        details: createCardDetails({
          name_lower: 'fabled passage',
        }),
      }),
    );
    deck.push(
      createCard({
        cardID: '00001611',
        tags: ['Landfall', 'Bad fetch'],
        details: createCardDetails({
          name_lower: 'bad river',
        }),
      }),
    );

    return deck;
  };

  const assertFilteredDeck = (filterText: string, expectedCardIds: string[]) => {
    const deck = getDeckWithTags();
    const { filter } = makeFilter(filterText);

    expect(filter).not.toBeNull();
    if (filter !== null) {
      const filteredCards = deck.filter(filter);

      //Sort as not caring about ordering in this
      expect(filteredCards.map((c) => c.cardID).sort()).toEqual(expectedCardIds.sort());
    }
  };

  it('Tag string partial match', async () => {
    assertFilteredDeck('tags:fetch', ['00001235', '00001522', '00001577', '00001611']);
    assertFilteredDeck('tag:insane', []);
    assertFilteredDeck('tags:Grix', ['00001522']);
  });

  it('Tag string partial match mulitple words, means tag match AND name filter', async () => {
    assertFilteredDeck('tags:fetch river', ['00001611']);
  });

  it('Tag string exact match', async () => {
    assertFilteredDeck('tags:"Fetchable"', ['00001522', '00001577']);
    assertFilteredDeck('tag:"Fetch lands"', ['00001235']);
    assertFilteredDeck('tags:"Artifacts"', []);
  });
});

const formatFilters = ['legality', 'legal', 'leg', 'banned', 'ban', 'restricted'];

describe.each(formatFilters)('Format filter (%s)', (filterName) => {
  const assertLegalityFilter = (result: FilterResult) => {
    expect(result.err).toBeFalsy();
    expect(result.filter).toBeInstanceOf(Function);
    //All format type filters use the card's legality information
    expect(result.filter?.fieldsUsed).toEqual(['legality']);
  };

  it.each(SUPPORTED_FORMATS)(`${filterName} filtering (%s)`, async (formatName) => {
    assertLegalityFilter(makeFilter(`${filterName}:${formatName}`));
    assertLegalityFilter(makeFilter(`${filterName}:"${formatName}"`));
  });

  it(`${filterName} filtering other operators`, async () => {
    assertLegalityFilter(makeFilter(`${filterName}=Legacy`));
    assertLegalityFilter(makeFilter(`${filterName}<>Standard`));
    assertLegalityFilter(makeFilter(`${filterName}!="Modern"`));
    assertLegalityFilter(makeFilter(`${filterName}!="Commander"`));
  });

  it(`${filterName} filtering unknown formats`, async () => {
    expect(makeFilter(`${filterName}:TinyLeaders`).err).toBeTruthy();
    expect(makeFilter(`${filterName}:Lega`).err).toBeTruthy();
    expect(makeFilter(`${filterName}:EDH`).err).toBeTruthy();
    expect(makeFilter(`${filterName}:"Oathbreaker"`).err).toBeTruthy();
  });
});

const powerToughnessFilters = [
  ['pow', 'power'],
  ['power', 'power'],
  ['tou', 'toughness'],
  ['tough', 'toughness'],
  ['toughness', 'toughness'],
  ['pt', 'pt'],
  ['wildpair', 'pt'],
];

describe.each(powerToughnessFilters)('Power/Toughness filter (%s)', (filterName, fieldUsed) => {
  const assertFilter = (result: FilterResult) => {
    expect(result.err).toBeFalsy();
    expect(result.filter).toBeInstanceOf(Function);
    expect(result.filter?.fieldsUsed).toEqual([fieldUsed]);
  };

  it(`${filterName} filtering`, async () => {
    assertFilter(makeFilter(`${filterName}=3`));
    assertFilter(makeFilter(`${filterName}:6`));
    assertFilter(makeFilter(`${filterName}<>2`));
    assertFilter(makeFilter(`${filterName}!=1`));
    assertFilter(makeFilter(`${filterName}>0`));
    assertFilter(makeFilter(`${filterName}<10`));
    assertFilter(makeFilter(`${filterName}>=3`));
    assertFilter(makeFilter(`${filterName}<=4`));
  });

  it(`${filterName} half decimal filters`, async () => {
    assertFilter(makeFilter(`${filterName}>0.5`));
    assertFilter(makeFilter(`${filterName}<2.5`));
    assertFilter(makeFilter(`${filterName}=.5`));
    assertFilter(makeFilter(`${filterName}!=.5`));
  });

  it(`${filterName} any other decimal fails`, async () => {
    expect(makeFilter(`${filterName}>0.6`).err).toBeTruthy();
    expect(makeFilter(`${filterName}!=1.2`).err).toBeTruthy();
  });
});

const powerToughnessComparisonFilters = [
  ['pow', 'tou'],
  ['pow', 'tough'],
  ['pow', 'toughness'],
  ['power', 'tou'],
  ['power', 'tough'],
  ['power', 'toughness'],
  ['tou', 'pow'],
  ['tough', 'pow'],
  ['toughness', 'pow'],
  ['tou', 'power'],
  ['tough', 'power'],
  ['toughness', 'power'],
];

describe.each(powerToughnessComparisonFilters)(
  'Power/Toughness comparison filter (%s)',
  (filterName, comparisonName) => {
    const assertFilter = (result: FilterResult) => {
      expect(result.err).toBeFalsy();
      expect(result.filter).toBeInstanceOf(Function);
      //Sort as we don't care order
      expect(result.filter?.fieldsUsed.sort()).toEqual(['power', 'toughness'].sort());
    };

    it(`${filterName} filtering`, async () => {
      assertFilter(makeFilter(`${filterName}=${comparisonName}`));
      assertFilter(makeFilter(`${filterName}:${comparisonName}`));
      assertFilter(makeFilter(`${filterName}<>${comparisonName}`));
      assertFilter(makeFilter(`${filterName}!=${comparisonName}`));
      assertFilter(makeFilter(`${filterName}>${comparisonName}`));
      assertFilter(makeFilter(`${filterName}<${comparisonName}`));
      assertFilter(makeFilter(`${filterName}>=${comparisonName}`));
      assertFilter(makeFilter(`${filterName}<=${comparisonName}`));
    });
  },
);

const assertColorIdentityFilter = (result: FilterResult) => {
  expect(result.err).toBeFalsy();
  expect(result.filter).toBeInstanceOf(Function);
  expect(result.filter?.fieldsUsed).toEqual(['color_identity']);
};

const colorIdentityFilters = [['ci'], ['id'], ['color_identity'], ['identity'], ['coloridentity']];

describe.each(colorIdentityFilters)('Color identity filter words (%s) (case insensitive)', (filterName) => {
  it(`${filterName} filtering is case insensitive`, async () => {
    assertColorIdentityFilter(makeFilter(`${filterName}=3`));
    assertColorIdentityFilter(makeFilter(`${filterName.toUpperCase()}=1`));
  });
});

describe('Color identity filtering (case insensitive)', () => {
  it(`Filtering with colorless aliases`, async () => {
    assertColorIdentityFilter(makeFilter(`ci=b`));
    assertColorIdentityFilter(makeFilter(`id=brown`));
    assertColorIdentityFilter(makeFilter(`identity!=COLORLESS`));
  });

  it(`Filtering by color names`, async () => {
    //Operators don't matter to this test
    assertColorIdentityFilter(makeFilter(`color_identity:white`));
    assertColorIdentityFilter(makeFilter(`color_identity<>bluE`));
    assertColorIdentityFilter(makeFilter(`color_identity<black`));
    assertColorIdentityFilter(makeFilter(`color_identity>green`));
    assertColorIdentityFilter(makeFilter(`color_identity>=red`));
  });

  it(`Filtering by guild names`, async () => {
    //Operators don't matter to this test
    assertColorIdentityFilter(makeFilter(`ID:azorius`));
    assertColorIdentityFilter(makeFilter(`ID<>iZZet`));
    assertColorIdentityFilter(makeFilter(`ID:dimir`));
    assertColorIdentityFilter(makeFilter(`ID!=RAKDOS`));
    assertColorIdentityFilter(makeFilter(`ID:grUUL`));
    assertColorIdentityFilter(makeFilter(`ID:Orzhov`));
    assertColorIdentityFilter(makeFilter(`ID:selesnya`));
    assertColorIdentityFilter(makeFilter(`ID:sIMIc`));
    assertColorIdentityFilter(makeFilter(`ID:BORos`));
    assertColorIdentityFilter(makeFilter(`ID:golGARI`));

    //"typo" cases
    assertColorIdentityFilter(makeFilter(`ID:azorious`));
    assertColorIdentityFilter(makeFilter(`ID:grul`));
    assertColorIdentityFilter(makeFilter(`ID:izet`));
  });

  it(`Filtering by shard/wedge names`, async () => {
    //Operators don't matter to this test
    assertColorIdentityFilter(makeFilter(`ID:BANT`));
    assertColorIdentityFilter(makeFilter(`ID<>ESPer`));
    assertColorIdentityFilter(makeFilter(`ID:naya`));
    assertColorIdentityFilter(makeFilter(`ID!=jund`));
    assertColorIdentityFilter(makeFilter(`ID:GRIXis`));
    assertColorIdentityFilter(makeFilter(`ID:sultai`));
    assertColorIdentityFilter(makeFilter(`ID:marDU`));
    assertColorIdentityFilter(makeFilter(`ID:ABZan`));
    assertColorIdentityFilter(makeFilter(`ID:jesKai`));
    assertColorIdentityFilter(makeFilter(`ID:temur`));
  });

  it(`Filtering by 5 color aliases`, async () => {
    //Operators don't matter to this test
    assertColorIdentityFilter(makeFilter(`coloridentity:RAINBOW`));
    assertColorIdentityFilter(makeFilter(`coloridentity<>fiveCOLOR`));
  });

  it(`Filtering by color letter combinations`, async () => {
    //Operators don't matter to this test
    assertColorIdentityFilter(makeFilter(`COLOR_IDentity:ubr`));
    assertColorIdentityFilter(makeFilter(`COLOR_IDentity<>rg`));
    assertColorIdentityFilter(makeFilter(`COLOR_IDentity>g`));
    assertColorIdentityFilter(makeFilter(`COLOR_IDentity<rgb`));
    assertColorIdentityFilter(makeFilter(`COLOR_IDentity<=ub`));
  });

  it(`Filtering by color count`, async () => {
    //Operators don't matter to this test
    assertColorIdentityFilter(makeFilter(`ci=3`));
    assertColorIdentityFilter(makeFilter(`ci!=4`));
    assertColorIdentityFilter(makeFilter(`ci>1`));
    assertColorIdentityFilter(makeFilter(`ci<5`));
    assertColorIdentityFilter(makeFilter(`ci=3`));
  });

  it(`Filtering is multicolor or not`, async () => {
    //Operators don't matter to this test
    assertColorIdentityFilter(makeFilter(`ci=m`));
    assertColorIdentityFilter(makeFilter(`ci!=m`));
    assertColorIdentityFilter(makeFilter(`ci:M`));
    assertColorIdentityFilter(makeFilter(`ci<>M`));
  });
});
