import { parseNonCSVLine } from 'serverutils/importParsing';

describe('parseNonCSVLine', () => {
  describe('empty / invalid input', () => {
    it('returns null for an empty string', () => {
      expect(parseNonCSVLine('')).toBeNull();
    });

    it('returns null for a whitespace-only line', () => {
      expect(parseNonCSVLine('   ')).toBeNull();
      expect(parseNonCSVLine('\t')).toBeNull();
      expect(parseNonCSVLine('  \t  ')).toBeNull();
    });
  });

  describe('name only', () => {
    it('parses a bare card name with an implicit count of 1', () => {
      expect(parseNonCSVLine('Plains')).toEqual({
        count: 1,
        name: 'Plains',
        set: undefined,
        collectorNumber: undefined,
      });
    });

    it('parses a multi-word name', () => {
      expect(parseNonCSVLine('Agent of the Fates')).toEqual({
        count: 1,
        name: 'Agent of the Fates',
        set: undefined,
        collectorNumber: undefined,
      });
    });

    it('trims surrounding whitespace from the line and the name', () => {
      expect(parseNonCSVLine('   Lightning Bolt   ')).toEqual({
        count: 1,
        name: 'Lightning Bolt',
        set: undefined,
        collectorNumber: undefined,
      });
    });
  });

  describe('counts', () => {
    it('parses "4 Plains" (space separated count)', () => {
      expect(parseNonCSVLine('4 Plains')).toMatchObject({ count: 4, name: 'Plains' });
    });

    it('parses "4x Plains" (lowercase x multiplier)', () => {
      expect(parseNonCSVLine('4x Plains')).toMatchObject({ count: 4, name: 'Plains' });
    });

    it('parses "4X Plains" (uppercase X multiplier)', () => {
      expect(parseNonCSVLine('4X Plains')).toMatchObject({ count: 4, name: 'Plains' });
    });

    it('parses multi-digit counts', () => {
      expect(parseNonCSVLine('10 Island')).toMatchObject({ count: 10, name: 'Island' });
      expect(parseNonCSVLine('123x Swamp')).toMatchObject({ count: 123, name: 'Swamp' });
    });

    it('parses counts separated by a tab', () => {
      expect(parseNonCSVLine('4\tPlains')).toMatchObject({ count: 4, name: 'Plains' });
    });

    it('tolerates multiple spaces between count and name', () => {
      expect(parseNonCSVLine('2   Plains')).toMatchObject({ count: 2, name: 'Plains' });
    });

    it('clamps a zero count up to 1', () => {
      expect(parseNonCSVLine('0 Plains')).toMatchObject({ count: 1, name: 'Plains' });
    });

    it('does NOT treat a count without a space ("4xPlains") as a multiplier', () => {
      expect(parseNonCSVLine('4xPlains')).toMatchObject({ count: 1, name: '4xPlains' });
    });

    it('keeps a leading number that is part of the name when it is the whole line', () => {
      // No trailing whitespace after the number, so it cannot be a count.
      expect(parseNonCSVLine('4')).toMatchObject({ count: 1, name: '4' });
    });

    it('keeps interior numbers in the name', () => {
      expect(parseNonCSVLine('4 Borrowing 100,000 Arrows')).toMatchObject({
        count: 4,
        name: 'Borrowing 100,000 Arrows',
      });
    });
  });

  describe('set in square brackets (Delver Lens / ManaPools style)', () => {
    it('parses "1 Agent of the Fates [ths]"', () => {
      expect(parseNonCSVLine('1 Agent of the Fates [ths]')).toEqual({
        count: 1,
        name: 'Agent of the Fates',
        set: 'ths',
        collectorNumber: undefined,
      });
    });

    it('preserves the set code casing verbatim (matching happens downstream)', () => {
      expect(parseNonCSVLine('4 Plains [M20]')).toMatchObject({ name: 'Plains', set: 'M20' });
      expect(parseNonCSVLine('4 Plains [m20]')).toMatchObject({ name: 'Plains', set: 'm20' });
    });

    it('parses set codes that start with a digit', () => {
      expect(parseNonCSVLine('1 Graveborn Muse [10e]')).toMatchObject({ name: 'Graveborn Muse', set: '10e' });
      expect(parseNonCSVLine('1 Dark Ritual [4ed]')).toMatchObject({ name: 'Dark Ritual', set: '4ed' });
    });

    it('parses "4 Plains [M20] 261" (set + collector number)', () => {
      expect(parseNonCSVLine('4 Plains [M20] 261')).toEqual({
        count: 4,
        name: 'Plains',
        set: 'M20',
        collectorNumber: '261',
      });
    });

    it('parses a bracketed set with no count', () => {
      expect(parseNonCSVLine('Agent of the Fates [ths]')).toMatchObject({
        count: 1,
        name: 'Agent of the Fates',
        set: 'ths',
      });
    });

    it('tolerates a tab before the bracketed set', () => {
      expect(parseNonCSVLine('1 Agent of the Fates\t[ths]')).toMatchObject({
        name: 'Agent of the Fates',
        set: 'ths',
      });
    });
  });

  describe('set in parentheses', () => {
    it('parses "4 Plains (M20)"', () => {
      expect(parseNonCSVLine('4 Plains (M20)')).toEqual({
        count: 4,
        name: 'Plains',
        set: 'M20',
        collectorNumber: undefined,
      });
    });

    it('parses "Lightning Bolt (LEA) 123" (paren set + collector number)', () => {
      expect(parseNonCSVLine('Lightning Bolt (LEA) 123')).toEqual({
        count: 1,
        name: 'Lightning Bolt',
        set: 'LEA',
        collectorNumber: '123',
      });
    });

    it('parses a parenthesised set with a count', () => {
      expect(parseNonCSVLine('2 Counterspell (TMP)')).toMatchObject({
        count: 2,
        name: 'Counterspell',
        set: 'TMP',
      });
    });
  });

  describe('collector numbers', () => {
    it('parses alphanumeric collector numbers', () => {
      expect(parseNonCSVLine('1 Plains [M20] 261a')).toMatchObject({ set: 'M20', collectorNumber: '261a' });
    });

    it('parses non-numeric collector numbers (e.g. star promos)', () => {
      expect(parseNonCSVLine('1 Plains [PLST] ★')).toMatchObject({ set: 'PLST', collectorNumber: '★' });
    });

    it('does not treat a trailing number as a collector number when there is no set', () => {
      // "quantity name set number" — the number is only meaningful alongside an edition. Without a
      // bracketed/parenthesised set it stays in the name.
      expect(parseNonCSVLine('4 Plains 261')).toMatchObject({
        count: 4,
        name: 'Plains 261',
        set: undefined,
        collectorNumber: undefined,
      });
    });
  });

  describe('names with special characters', () => {
    it('parses names containing apostrophes', () => {
      expect(parseNonCSVLine("1 Arguel's Blood Fast [v17]")).toMatchObject({
        name: "Arguel's Blood Fast",
        set: 'v17',
      });
    });

    it('parses names containing commas', () => {
      expect(parseNonCSVLine('1 Anowon, the Ruin Sage [wwk]')).toMatchObject({
        name: 'Anowon, the Ruin Sage',
        set: 'wwk',
      });
    });

    it('parses names containing hyphens', () => {
      expect(parseNonCSVLine('2 Ill-Gotten Gains [cns]')).toMatchObject({
        count: 2,
        name: 'Ill-Gotten Gains',
        set: 'cns',
      });
    });

    it('parses split-card style names with slashes', () => {
      expect(parseNonCSVLine('1 Fire // Ice [apc]')).toMatchObject({ name: 'Fire // Ice', set: 'apc' });
    });
  });

  describe('names that themselves contain brackets or parentheses', () => {
    it('leaves a multi-word parenthetical suffix in the name (not a set)', () => {
      // Set codes never contain whitespace, so "(Big Furry Monster)" is part of the name.
      expect(parseNonCSVLine('B.F.M. (Big Furry Monster)')).toMatchObject({
        count: 1,
        name: 'B.F.M. (Big Furry Monster)',
        set: undefined,
      });
    });

    it('leaves a multi-word bracketed suffix in the name (not a set)', () => {
      expect(parseNonCSVLine('1 Some Custom Card [big token]')).toMatchObject({
        name: 'Some Custom Card [big token]',
        set: undefined,
      });
    });
  });

  describe('realistic Delver Lens export lines', () => {
    const cases: [string, { count: number; name: string; set: string }][] = [
      ["1 Arguel's Blood Fast [v17]", { count: 1, name: "Arguel's Blood Fast", set: 'v17' }],
      ['2 Dark Hatchling [cmd]', { count: 2, name: 'Dark Hatchling', set: 'cmd' }],
      ['1 Nightmare [m14]', { count: 1, name: 'Nightmare', set: 'm14' }],
      ['1 Nightmare [m15]', { count: 1, name: 'Nightmare', set: 'm15' }],
      ['1 Sidisi, Undead Vizier [dtk]', { count: 1, name: 'Sidisi, Undead Vizier', set: 'dtk' }],
      ['1 Void Maw [csp]', { count: 1, name: 'Void Maw', set: 'csp' }],
      ["1 Yawgmoth's Bargain [uds]", { count: 1, name: "Yawgmoth's Bargain", set: 'uds' }],
    ];

    it.each(cases)('parses %s', (line, expected) => {
      expect(parseNonCSVLine(line)).toMatchObject(expected);
    });

    it('distinguishes the same card in different sets', () => {
      const m14 = parseNonCSVLine('1 Nightmare [m14]');
      const m15 = parseNonCSVLine('1 Nightmare [m15]');
      expect(m14).toMatchObject({ name: 'Nightmare', set: 'm14' });
      expect(m15).toMatchObject({ name: 'Nightmare', set: 'm15' });
    });
  });
});
