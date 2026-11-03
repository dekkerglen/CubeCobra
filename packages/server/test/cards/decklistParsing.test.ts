import { decklistSectionMarker, parseDecklist } from '@utils/decklistParsing';
import { MAX_IMPORT_LINE_COUNT } from '@utils/importParsing';

describe('decklistSectionMarker', () => {
  it('matches a bare Sideboard line', () => {
    expect(decklistSectionMarker('Sideboard')).toBe('sideboard');
  });

  it('matches SB', () => {
    expect(decklistSectionMarker('SB')).toBe('sideboard');
  });

  it('matches Deck, Maindeck, and Main', () => {
    expect(decklistSectionMarker('Deck')).toBe('mainboard');
    expect(decklistSectionMarker('Maindeck')).toBe('mainboard');
    expect(decklistSectionMarker('Main')).toBe('mainboard');
  });

  it('is case insensitive', () => {
    expect(decklistSectionMarker('sideboard')).toBe('sideboard');
    expect(decklistSectionMarker('SIDEBOARD')).toBe('sideboard');
    expect(decklistSectionMarker('deck')).toBe('mainboard');
  });

  it('tolerates a leading // and a trailing colon', () => {
    expect(decklistSectionMarker('// Sideboard:')).toBe('sideboard');
    expect(decklistSectionMarker('//Deck')).toBe('mainboard');
    expect(decklistSectionMarker('Sideboard:')).toBe('sideboard');
  });

  it('tolerates trailing whitespace and a carriage return', () => {
    expect(decklistSectionMarker('Sideboard \r')).toBe('sideboard');
    expect(decklistSectionMarker('   Deck   ')).toBe('mainboard');
  });

  it('returns null for a counted line that reads like a marker', () => {
    expect(decklistSectionMarker('1 Sideboard')).toBeNull();
    expect(decklistSectionMarker('2x Deck')).toBeNull();
  });

  it('returns null for an ordinary card name', () => {
    expect(decklistSectionMarker('Lightning Bolt')).toBeNull();
    expect(decklistSectionMarker('Sideboard Shuffle')).toBeNull();
  });

  it('returns null for a name that collides with an Object prototype key', () => {
    expect(decklistSectionMarker('toString')).toBeNull();
    expect(decklistSectionMarker('constructor')).toBeNull();
  });

  it('returns null for an empty line', () => {
    expect(decklistSectionMarker('')).toBeNull();
    expect(decklistSectionMarker('   ')).toBeNull();
  });
});

describe('parseDecklist', () => {
  it('assigns every line to the default board when no marker is present', () => {
    expect(parseDecklist('Lightning Bolt\n2 Island', 'mainboard')).toEqual([
      { board: 'mainboard', count: 1, name: 'Lightning Bolt', line: 'Lightning Bolt' },
      { board: 'mainboard', count: 2, name: 'Island', line: '2 Island' },
    ]);

    expect(parseDecklist('Lightning Bolt\n2 Island', 'sideboard').map((entry) => entry.board)).toEqual([
      'sideboard',
      'sideboard',
    ]);
  });

  it('sends lines beneath a Sideboard marker to the sideboard', () => {
    const entries = parseDecklist('Lightning Bolt\nSideboard\nNegate\nDuress', 'mainboard');

    expect(entries).toEqual([
      { board: 'mainboard', count: 1, name: 'Lightning Bolt', line: 'Lightning Bolt' },
      { board: 'sideboard', count: 1, name: 'Negate', line: 'Negate' },
      { board: 'sideboard', count: 1, name: 'Duress', line: 'Duress' },
    ]);
  });

  it('returns to the mainboard on a Deck marker', () => {
    const entries = parseDecklist('Sideboard\nNegate\nDeck\nLightning Bolt', 'mainboard');

    expect(entries.map((entry) => [entry.board, entry.name])).toEqual([
      ['sideboard', 'Negate'],
      ['mainboard', 'Lightning Bolt'],
    ]);
  });

  it('treats a marker on the first line as the starting board', () => {
    const entries = parseDecklist('Sideboard\nNegate', 'mainboard');

    expect(entries).toEqual([{ board: 'sideboard', count: 1, name: 'Negate', line: 'Negate' }]);
  });

  it('yields nothing extra for a marker with no lines beneath it', () => {
    const entries = parseDecklist('Lightning Bolt\nSideboard\n', 'mainboard');

    expect(entries).toEqual([{ board: 'mainboard', count: 1, name: 'Lightning Bolt', line: 'Lightning Bolt' }]);
  });

  it('does not switch boards on a blank line', () => {
    const entries = parseDecklist('Lightning Bolt\n\n   \nIsland', 'mainboard');

    expect(entries.map((entry) => [entry.board, entry.name])).toEqual([
      ['mainboard', 'Lightning Bolt'],
      ['mainboard', 'Island'],
    ]);
  });

  it('splits CRLF input', () => {
    const entries = parseDecklist('Lightning Bolt\r\nSideboard\r\nNegate', 'mainboard');

    expect(entries.map((entry) => [entry.board, entry.name])).toEqual([
      ['mainboard', 'Lightning Bolt'],
      ['sideboard', 'Negate'],
    ]);
  });

  it('keeps the quantity from a counted line', () => {
    expect(parseDecklist('2x Island', 'mainboard')).toEqual([
      { board: 'mainboard', count: 2, name: 'Island', line: '2x Island' },
    ]);
  });

  it('clamps a count above MAX_IMPORT_LINE_COUNT', () => {
    expect(parseDecklist('4000 Plains', 'mainboard')).toEqual([
      { board: 'mainboard', count: MAX_IMPORT_LINE_COUNT, name: 'Plains', line: '4000 Plains' },
    ]);
  });

  it('drops the set and collector number from a Draftmancer line', () => {
    expect(parseDecklist('1 Bolt (2X2) 117', 'mainboard')).toEqual([
      { board: 'mainboard', count: 1, name: 'Bolt', line: '1 Bolt (2X2) 117' },
    ]);
  });

  it('preserves the original text in line', () => {
    expect(parseDecklist('  2 Island [M20] 261  ', 'mainboard')).toEqual([
      { board: 'mainboard', count: 2, name: 'Island', line: '  2 Island [M20] 261  ' },
    ]);
  });

  it('omits lines parseNonCSVLine rejects', () => {
    const entries = parseDecklist('Lightning Bolt\n\t\nIsland', 'mainboard');

    expect(entries.map((entry) => entry.name)).toEqual(['Lightning Bolt', 'Island']);
  });

  it('returns an empty array for empty input', () => {
    expect(parseDecklist('', 'mainboard')).toEqual([]);
    expect(parseDecklist('   \n\n', 'mainboard')).toEqual([]);
  });
});
