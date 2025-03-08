import { FilterResult, makeFilter } from '../../src/client/filtering/FilterCards';

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
    assertValidTagFilter(makeFilter('tag:fetch'));
    assertValidTagFilter(makeFilter('tags:fetch'));
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
});

const formatFilters = ['legality', 'legal', 'leg', 'banned', 'ban', 'restricted'];

describe.each(formatFilters)('Format filter (%s)', (filterName) => {
  const assertLegalityFilter = (result: FilterResult) => {
    expect(result.err).toBeFalsy();
    expect(result.filter).toBeInstanceOf(Function);
    //All format type filters use the card's legality information
    expect(result.filter?.fieldsUsed).toEqual(['legality']);
  };

  const availableFormats = [
    'Standard',
    'Pioneer',
    'Modern',
    'Legacy',
    'Vintage',
    'Brawl',
    'Historic',
    'Pauper',
    'Penny',
    'Commander',
  ];

  it.each(availableFormats)(`${filterName} filtering (%s)`, async (formatName) => {
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
