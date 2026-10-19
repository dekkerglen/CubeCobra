import Card, { SUPPORTED_FORMATS } from '@utils/datatypes/Card';
import { FilterResult, makeFilter } from '@utils/filtering/FilterCards';

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

  it('Tag contents filter operations', async () => {
    //`:` is a partial match, `=` is an exact match; both accept quoted or unquoted values
    assertValidTagFilter(makeFilter('tag:fetch'));
    assertValidTagFilter(makeFilter('tags:fetch'));
    assertValidTagFilter(makeFilter('tag:"fetch"'));
    assertValidTagFilter(makeFilter("tags:'fetch'"));
    assertValidTagFilter(makeFilter('tag=fetch'));
    assertValidTagFilter(makeFilter('tags=foo'));
    assertValidTagFilter(makeFilter('tag="fetch"'));
    assertValidTagFilter(makeFilter('tags="foo"'));
    assertValidTagFilter(makeFilter("tag='fetch'"));
    assertValidTagFilter(makeFilter("tags='foo'"));
  });

  it('Tag count filter operations', async () => {
    //Numeric operands still mean tag count
    assertValidTagFilter(makeFilter('tag=3'));
    assertValidTagFilter(makeFilter('tags=0'));
    assertValidTagFilter(makeFilter('tag!=3'));
    assertValidTagFilter(makeFilter('tag<>3'));
    assertValidTagFilter(makeFilter('tag>0'));
    assertValidTagFilter(makeFilter('tag>=0'));
    assertValidTagFilter(makeFilter('tag<2'));
    assertValidTagFilter(makeFilter('tag<=1'));
  });

  it('A bare numeric tag= stays count, not an exact match', async () => {
    //`tag=3` is unambiguously the count comparison; the string branch rejects pure integers.
    //Quote the value (`tag="3"`) to match a tag literally named "3".
    assertValidTagFilter(makeFilter('tag=3'));
    assertValidTagFilter(makeFilter('tag="3"'));
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

  it('Tag string partial match (unquoted colon)', async () => {
    //`:` matches any tag containing the value.
    assertFilteredDeck('tags:fetch', ['00001235', '00001522', '00001577', '00001611']);
    assertFilteredDeck('tag:insane', []);
    assertFilteredDeck('tags:Grix', ['00001522']);
  });

  it('Tag string partial match combined with a name filter', async () => {
    assertFilteredDeck('tags:fetch river', ['00001611']);
  });

  it('Tag exact match with = operator', async () => {
    //`=` matches the whole tag exactly, so "fetch" (a substring of several tags) matches none.
    assertFilteredDeck('tags=fetchable', ['00001522', '00001577']);
    assertFilteredDeck('tag="Fetch lands"', ['00001235']);
    assertFilteredDeck('tags=fetch', []);
    assertFilteredDeck('tags=grixis', ['00001522']);
  });

  it('Tag string exact match (quoted colon)', async () => {
    //A quoted value after `:` is also exact.
    assertFilteredDeck('tags:"Fetchable"', ['00001522', '00001577']);
    assertFilteredDeck('tag:"Fetch lands"', ['00001235']);
    assertFilteredDeck('tags:"Artifacts"', []);
  });

  it('Tag count matching', async () => {
    //Bare numeric operands are counts: only the empty-tag card has zero tags.
    assertFilteredDeck('tags=0', ['00001234']);
  });
});

describe('Oracle tag and art tag filter syntax', () => {
  const getDeckWithScryfallTags = (): Card[] => [
    createCard({
      cardID: 'OT01',
      details: createCardDetails({ name_lower: 'wrath of god', oracle_tags: ['board-wipe', 'removal'] }),
    }),
    createCard({
      cardID: 'OT02',
      details: createCardDetails({ name_lower: 'swords to plowshares', oracle_tags: ['spot-removal'] }),
    }),
    createCard({
      cardID: 'AT01',
      details: createCardDetails({ name_lower: 'shivan dragon', art_tags: ['dragon', 'landscape'] }),
    }),
  ];

  const assertFilteredScryfall = (filterText: string, expectedCardIds: string[]) => {
    const { filter } = makeFilter(filterText);
    expect(filter).not.toBeNull();
    if (filter !== null) {
      const filtered = getDeckWithScryfallTags().filter(filter);
      expect(filtered.map((c) => c.cardID).sort()).toEqual(expectedCardIds.sort());
    }
  };

  it('Oracle tag `:` is a partial match, `=` is exact', async () => {
    //`:` matches any slug containing the value, so "removal" hits both removal and spot-removal.
    assertFilteredScryfall('otag:removal', ['OT01', 'OT02']);
    assertFilteredScryfall('otag:wipe', ['OT01']);
    //`=` matches the whole slug exactly.
    assertFilteredScryfall('otag=removal', ['OT01']);
    assertFilteredScryfall('oracletag=spot-removal', ['OT02']);
    assertFilteredScryfall('otag=wipe', []);
  });

  it('Oracle tag matching ignores hyphens on both sides', async () => {
    assertFilteredScryfall('otag:board-wipe', ['OT01']);
    assertFilteredScryfall('otag:boardwipe', ['OT01']);
    assertFilteredScryfall('oracletag=boardwipe', ['OT01']);
  });

  it('Oracle tag count still works', async () => {
    assertFilteredScryfall('oracletags>1', ['OT01']);
  });

  it('Art tag `:` is partial, `=` is exact', async () => {
    assertFilteredScryfall('atag:dragon', ['AT01']);
    assertFilteredScryfall('arttag=dragon', ['AT01']);
    //`:` partial matches the substring, `=` exact does not.
    assertFilteredScryfall('atag:landscap', ['AT01']);
    assertFilteredScryfall('arttag=landscap', []);
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

describe('Word count filter syntax', () => {
  const cardWithText = (name: string, oracle_text: string): Card =>
    createCard({ details: createCardDetails({ name, name_lower: name.toLowerCase(), oracle_text }) });

  const shortCard = cardWithText('Short', 'Draw a card');
  const mediumCard = cardWithText('Medium', 'Draw two cards and gain three life');
  const longCard = cardWithText(
    'Long',
    'Whenever this creature attacks, target opponent reveals their hand and you may cast a spell for free',
  );

  it.each(['words', 'wc', 'wordcount', 'WORDCOUNT'])('parses %s alias', (alias) => {
    const { err, filter } = makeFilter(`${alias}>5`);
    expect(err).toBeFalsy();
    expect(filter?.fieldsUsed).toEqual(['wordCount']);
  });

  it('filters by word count', () => {
    const { filter } = makeFilter('words>5');
    expect(filter!(shortCard)).toBe(false);
    expect(filter!(mediumCard)).toBe(true);
    expect(filter!(longCard)).toBe(true);

    const { filter: filter2 } = makeFilter('wc<=7');
    expect(filter2!(shortCard)).toBe(true);
    expect(filter2!(mediumCard)).toBe(true);
    expect(filter2!(longCard)).toBe(false);

    const { filter: filter3 } = makeFilter('wordcount=7');
    expect(filter3!(shortCard)).toBe(false);
    expect(filter3!(mediumCard)).toBe(true);
    expect(filter3!(longCard)).toBe(false);
  });
});

describe('Quantity filter syntax', () => {
  const single = createCard({ details: createCardDetails({ name: 'Solo', name_lower: 'solo' }) });
  const paired = { ...createCard({ details: createCardDetails({ name: 'Duo', name_lower: 'duo' }) }), quantity: 2 };
  const trio = { ...createCard({ details: createCardDetails({ name: 'Trio', name_lower: 'trio' }) }), quantity: 3 };

  it.each(['quantity', 'count', 'copies', 'QUANTITY'])('parses %s alias', (alias) => {
    const { err, filter } = makeFilter(`${alias}>1`);
    expect(err).toBeFalsy();
    expect(filter?.fieldsUsed).toEqual(['quantity']);
  });

  it('filters unannotated cards as singletons', () => {
    const { filter } = makeFilter('quantity=1');
    expect(filter!(single)).toBe(true);
    expect(filter!(paired)).toBe(false);
  });

  it('filters by stamped quantity', () => {
    const { filter } = makeFilter('copies>=2');
    expect(filter!(single)).toBe(false);
    expect(filter!(paired)).toBe(true);
    expect(filter!(trio)).toBe(true);
  });

  it('is:singleton matches unannotated and quantity=1 cards, not:singleton the rest', () => {
    const { filter: isFilter } = makeFilter('is:singleton');
    expect(isFilter!(single)).toBe(true);
    expect(isFilter!(paired)).toBe(false);

    const { filter: notFilter } = makeFilter('not:singleton');
    expect(notFilter!(single)).toBe(false);
    expect(notFilter!(paired)).toBe(true);
    expect(notFilter!(trio)).toBe(true);
  });
});

describe('Oracle text name placeholder', () => {
  const cardWithText = (name: string, oracle_text: string, type = 'Creature — Human'): Card =>
    createCard({ details: createCardDetails({ name, name_lower: name.toLowerCase(), oracle_text, type }) });

  const matches = (query: string, card: Card): boolean => {
    const { err, filter } = makeFilter(query);
    expect(err).toBeFalsy();
    return filter!(card);
  };

  it('matches the card name', () => {
    expect(
      matches('o:"~ deals 3"', cardWithText('Lightning Bolt', 'Lightning Bolt deals 3 damage to any target.')),
    ).toBe(true);
  });

  it.each([
    ['this creature', 'When this creature enters, draw a card.'],
    ['this artifact', 'When this artifact enters, draw a card.'],
    ['this enchantment', 'When this enchantment enters, draw a card.'],
    ['this land', 'When this land enters, draw a card.'],
    ['this Aura', 'When this Aura enters, draw a card.'],
  ])('matches "%s" self-references', (_, text) => {
    expect(matches('o:"when ~ enters"', cardWithText('Some Card', text))).toBe(true);
  });

  it('matches capitalized self-references', () => {
    expect(
      matches('o:"~ deals 3"', cardWithText('Some Card', '{T}: This creature deals 3 damage to any target.')),
    ).toBe(true);
  });

  it('does not match unrelated "this" phrases', () => {
    expect(matches('o:"~ ends"', cardWithText('Some Card', 'Draw a card. This turn ends.'))).toBe(false);
  });

  it('matches each face of a multi-faced card', () => {
    const card = cardWithText('Front Face // Back Face', 'When Back Face enters, draw a card.');
    expect(matches('o:"when ~ enters"', card)).toBe(true);
  });

  it('handles regex characters in card names', () => {
    expect(
      matches('o:"~ enters"', cardWithText('Question Elemental?', 'When Question Elemental? enters, scry 1.')),
    ).toBe(true);
  });
});

describe('is:custom', () => {
  const matches = (query: string, card: Card): boolean => {
    const { err, filter } = makeFilter(query);
    expect(err).toBeFalsy();
    return filter!(card);
  };

  const customCard = createCard({ cardID: 'custom-card', custom_name: 'My Custom' });
  const voucherCard = createCard({ cardID: 'voucher', custom_name: 'Zoo Kickstarter' });
  const realCard = createCard({ cardID: 'a1b2c3d4-0000-0000-0000-000000000000' });

  it('matches a custom card', () => {
    expect(matches('is:custom', customCard)).toBe(true);
  });

  it('does not match a voucher', () => {
    expect(matches('is:custom', voucherCard)).toBe(false);
  });

  it('does not match a real card', () => {
    expect(matches('is:custom', realCard)).toBe(false);
  });

  it('works through the has: alias', () => {
    expect(matches('has:custom', customCard)).toBe(true);
    expect(matches('has:custom', realCard)).toBe(false);
  });

  it('inverts with -is: and not:', () => {
    expect(matches('-is:custom', customCard)).toBe(false);
    expect(matches('-is:custom', realCard)).toBe(true);
    expect(matches('not:custom', customCard)).toBe(false);
    expect(matches('not:custom', realCard)).toBe(true);
  });

  it('composes with is:voucher to cover both', () => {
    expect(matches('is:custom or is:voucher', customCard)).toBe(true);
    expect(matches('is:custom or is:voucher', voucherCard)).toBe(true);
    expect(matches('is:custom or is:voucher', realCard)).toBe(false);
  });
});

describe('is:override', () => {
  const matches = (query: string, card: Card): boolean => {
    const { err, filter } = makeFilter(query);
    expect(err).toBeFalsy();
    return filter!(card);
  };

  const plainCard = () => createCard({ cardID: 'a1b2c3d4-0000-0000-0000-000000000000' });

  it('does not match a card with no overrides', () => {
    expect(matches('is:override', plainCard())).toBe(false);
  });

  it.each([
    ['colors', { colors: ['R'] as any }],
    ['colorCategory', { colorCategory: 'Red' as any }],
    ['cmc', { cmc: 4 }],
    ['type_line', { type_line: 'Artifact' }],
    ['rarity', { rarity: 'mythic' }],
    ['imgUrl', { imgUrl: 'https://example.com/front.png' }],
    ['imgBackUrl', { imgBackUrl: 'https://example.com/back.png' }],
  ])('matches a card whose %s was overridden', (_label, override) => {
    expect(matches('is:override', createCard({ ...plainCard(), ...override }))).toBe(true);
  });

  it('does not match a card that only has a custom name', () => {
    expect(matches('is:override', createCard({ ...plainCard(), custom_name: 'Renamed' }))).toBe(false);
  });

  it('does not match a custom card even when those fields are populated', () => {
    const custom = createCard({ cardID: 'custom-card', type_line: 'Artifact', cmc: 3, imgUrl: 'https://e.com/a.png' });
    expect(matches('is:override', custom)).toBe(false);
  });

  it('does not match a voucher even when those fields are populated', () => {
    const voucher = createCard({ cardID: 'voucher', type_line: 'Artifact', cmc: 3, imgUrl: 'https://e.com/a.png' });
    expect(matches('is:override', voucher)).toBe(false);
  });

  it('accepts the overridden spelling as the same filter', () => {
    const overridden = createCard({ ...plainCard(), rarity: 'mythic' });
    expect(matches('is:overridden', overridden)).toBe(true);
    expect(matches('is:overridden', plainCard())).toBe(false);
  });

  it('works through has: and inverts with -is: and not:', () => {
    const overridden = createCard({ ...plainCard(), cmc: 4 });
    expect(matches('has:override', overridden)).toBe(true);
    expect(matches('-is:override', overridden)).toBe(false);
    expect(matches('-is:override', plainCard())).toBe(true);
    expect(matches('not:override', overridden)).toBe(false);
  });
});

describe('custom image filters', () => {
  const matches = (query: string, card: Card): boolean => {
    const { err, filter } = makeFilter(query);
    expect(err).toBeFalsy();
    return filter!(card);
  };

  const base = () => createCard({ cardID: 'a1b2c3d4-0000-0000-0000-000000000000' });
  const frontOnly = () => createCard({ ...base(), imgUrl: 'https://example.com/front.png' });
  const backOnly = () => createCard({ ...base(), imgBackUrl: 'https://example.com/back.png' });
  const bothFaces = () =>
    createCard({ ...base(), imgUrl: 'https://example.com/front.png', imgBackUrl: 'https://example.com/back.png' });

  it.each([
    ['no custom image', false],
    ['front only', true],
    ['back only', true],
    ['both faces', true],
  ])('is:image with %s', (label, expected) => {
    const card = { 'no custom image': base, 'front only': frontOnly, 'back only': backOnly, 'both faces': bothFaces }[
      label
    ]!();
    expect(matches('is:image', card)).toBe(expected);
  });

  it('is:imageUrl matches only when the front image is set', () => {
    expect(matches('is:imageUrl', frontOnly())).toBe(true);
    expect(matches('is:imageUrl', bothFaces())).toBe(true);
    expect(matches('is:imageUrl', backOnly())).toBe(false);
    expect(matches('is:imageUrl', base())).toBe(false);
  });

  it('is:imageBackUrl matches only when the back image is set', () => {
    expect(matches('is:imageBackUrl', backOnly())).toBe(true);
    expect(matches('is:imageBackUrl', bothFaces())).toBe(true);
    expect(matches('is:imageBackUrl', frontOnly())).toBe(false);
    expect(matches('is:imageBackUrl', base())).toBe(false);
  });

  it('matches regardless of the casing used', () => {
    expect(matches('is:imageurl', frontOnly())).toBe(true);
    expect(matches('is:IMAGEBACKURL', backOnly())).toBe(true);
  });

  it('finds cards still needing an image via negation', () => {
    expect(matches('-has:image', base())).toBe(true);
    expect(matches('-has:image', frontOnly())).toBe(false);
    expect(matches('not:image', base())).toBe(true);
  });

  it('matches a custom card that has an image, so authors can audit their own art', () => {
    const customWithArt = createCard({ cardID: 'custom-card', imgUrl: 'https://example.com/mine.png' });
    const customWithoutArt = createCard({ cardID: 'custom-card' });
    expect(matches('is:image', customWithArt)).toBe(true);
    expect(matches('is:image', customWithoutArt)).toBe(false);
  });
});
