import { FilterResult, makeFilter } from '../../src/client/filtering/FilterCards';

describe('Filter syntax', () => {
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
  });

  const failingNamesWithInterestingCharacters = ['Hazmat Suit (Used)'];

  it.each(failingNamesWithInterestingCharacters)('Failing names with interesting characters (%s)', async (name) => {
    const result = makeFilter(name);
    expect(result.err).toBeTruthy();
  });
});
