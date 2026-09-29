/**
 * The Synergy Connect theme pool: what a day's puzzle can be about.
 *
 * The card catalog is never loaded here. The derivation of the tribe pool takes
 * its legend list as an argument and the draw takes its pools as an argument, both
 * so this can be a fast unit test over hand-built data — the same split the
 * crossword's schedule.ts uses. What the real catalog produces is measured
 * separately; what needs pinning in CI is the rules.
 */
import { makeFilter } from '@utils/filtering/FilterCards';
import {
  clearTribePoolCache,
  drawTheme,
  enumerateThemes,
  LEGENDARY_CREATURE_FILTER,
  pluralizeCreatureType,
  SynergyConnectThemeKind,
  SynergyConnectThemePools,
  themeFor,
  THEME_KINDS,
  themePools,
  uncommonLegendaryTribes,
  uncommonTribesFrom,
  valuesFor,
} from 'serverutils/synergyconnect/themes';

/** The tribe band the real catalog currently yields, including the awkward plurals. */
const pools = (): SynergyConnectThemePools => ({
  tribes: [
    'Bard',
    'Beast',
    'Berserker',
    'Citizen',
    'Dinosaur',
    'Dog',
    'Dwarf',
    'Eldrazi',
    'Faerie',
    'Frog',
    'Giant',
    'Halfling',
    'Horror',
    'Hydra',
    'Minotaur',
    'Nightmare',
    'Ogre',
    'Ooze',
    'Peasant',
    'Pirate',
    'Praetor',
    'Ranger',
    'Samurai',
    'Shapeshifter',
    'Snake',
    'Sphinx',
    'Treefolk',
  ],
});

/** Consecutive real dates, enough of them for every kind to be drawn many times. */
const manyDates = (count: number): string[] => {
  const dates: string[] = [];
  const cursor = new Date('2026-10-01T00:00:00Z');
  for (let i = 0; i < count; i++) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

describe('theme kinds', () => {
  it('is the four constrained kinds and nothing broader', () => {
    expect([...THEME_KINDS]).toEqual(['monocolour', 'guild', 'shard', 'tribe']);
  });

  it('offers exactly the ten guilds and the ten shards and wedges', () => {
    expect(valuesFor('monocolour', pools())).toEqual(['W', 'U', 'B', 'R', 'G', 'C']);
    expect(valuesFor('guild', pools())).toHaveLength(10);
    expect(valuesFor('shard', pools())).toHaveLength(10);
    // Every two-colour pair exactly once, in either letter order.
    const pairs = valuesFor('guild', pools()).map((value) => [...value].sort().join(''));
    expect(new Set(pairs).size).toBe(10);
    const triples = valuesFor('shard', pools()).map((value) => [...value].sort().join(''));
    expect(new Set(triples).size).toBe(10);
  });
});

describe('theme filters', () => {
  /**
   * Enumerated rather than sampled: a value whose filter doesn't parse is a value
   * some date will eventually draw, and sampling would find it on that day instead
   * of in CI.
   */
  it('parses every filter the pool can produce, as the generator composes it', () => {
    const themes = enumerateThemes(pools());
    expect(themes.length).toBe(6 + 10 + 10 + pools().tribes.length);
    for (const theme of themes) {
      expect(makeFilter(theme.filterText).err).toBeFalsy();
      // The generator always ANDs the theme onto the legendary-creature pool, and
      // that composition is what actually has to parse.
      expect(makeFilter(`${LEGENDARY_CREATURE_FILTER} ${theme.filterText}`).err).toBeFalsy();
    }
  });

  it('quotes a multi-word creature type so the filter still parses', () => {
    const theme = themeFor('tribe', 'Time Lord');
    expect(theme.filterText).toBe('t:"Time Lord"');
    expect(makeFilter(`${LEGENDARY_CREATURE_FILTER} ${theme.filterText}`).err).toBeFalsy();
  });

  /**
   * THE WHOLE POINT OF THE CHANGE. `ci:WU` is `ci<=WU` — it folds every mono-white,
   * mono-blue and colourless legend into "Azorius" — and that breadth is what the
   * owner complained about. Asserting the text is `ci=` would be a spelling test,
   * so this runs the compiled filter against cards on both sides of the line.
   */
  describe('colour identity is exact and not "within"', () => {
    // Filters run against a Card, reading colour identity off `details` exactly as
    // `filterCardsDetails` hands it to them.
    const card = (colorIdentity: string[]) => ({
      details: { color_identity: colorIdentity, type: 'Legendary Creature — Human' },
    });

    const matches = (filterText: string, colorIdentity: string[]): boolean => {
      const { err, filter } = makeFilter(filterText);
      expect(err).toBeFalsy();
      return filter!(card(colorIdentity) as never);
    };

    it('accepts only the exact pair for a guild', () => {
      const { filterText } = themeFor('guild', 'WU');
      expect(matches(filterText, ['W', 'U'])).toBe(true);
      expect(matches(filterText, ['U', 'W'])).toBe(true);
      // Subsets are the ones "within" would wrongly let in.
      expect(matches(filterText, ['W'])).toBe(false);
      expect(matches(filterText, ['U'])).toBe(false);
      expect(matches(filterText, [])).toBe(false);
      // And supersets stay out either way.
      expect(matches(filterText, ['W', 'U', 'B'])).toBe(false);
    });

    it('accepts only the exact triple for a shard or wedge', () => {
      const { filterText } = themeFor('shard', 'GWU');
      expect(matches(filterText, ['G', 'W', 'U'])).toBe(true);
      expect(matches(filterText, ['W', 'U'])).toBe(false);
      expect(matches(filterText, ['G', 'W', 'U', 'B'])).toBe(false);
    });

    it('keeps a monocolour mono, and colourless colourless', () => {
      const mono = themeFor('monocolour', 'R');
      expect(matches(mono.filterText, ['R'])).toBe(true);
      expect(matches(mono.filterText, ['R', 'G'])).toBe(false);
      expect(matches(mono.filterText, [])).toBe(false);

      const colourless = themeFor('monocolour', 'C');
      expect(matches(colourless.filterText, [])).toBe(true);
      expect(matches(colourless.filterText, ['R'])).toBe(false);
    });

    it('uses "=" rather than ":" for every colour kind', () => {
      for (const kind of ['monocolour', 'guild', 'shard'] as SynergyConnectThemeKind[]) {
        for (const value of valuesFor(kind, pools())) {
          expect(themeFor(kind, value).filterText).toMatch(/^ci=[wubrgc]+$/);
        }
      }
    });
  });
});

describe('theme wording', () => {
  /** Both render sites put the description straight after these two words. */
  const sentence = (description: string): string => `Today's are all legendary creatures ${description}.`;

  it('reads as a sentence for every theme the pool can produce', () => {
    for (const theme of enumerateThemes(pools())) {
      expect(theme.description).not.toBe('');
      // Lower case and no leading article: it continues a sentence, it doesn't start one.
      expect(theme.description[0]).toBe(theme.description[0]!.toLowerCase());
      expect(theme.description).not.toMatch(/^(a|an|the)\s/);
      // Never the filter grammar leaking through to the page.
      expect(theme.description).not.toMatch(/ci=|t:|keyword:|set:/);
    }
  });

  /**
   * The owner has corrected this twice: Synergy Connect is not a commander game.
   * Internal identifiers still say `commander`, and that is fine; nothing a solver
   * reads may.
   */
  it('never says "commander"', () => {
    for (const theme of enumerateThemes(pools())) {
      expect(sentence(theme.description).toLowerCase()).not.toContain('commander');
    }
  });

  it('words each kind the way it should read', () => {
    expect(sentence(themeFor('monocolour', 'W').description)).toBe(
      "Today's are all legendary creatures in mono-white.",
    );
    expect(sentence(themeFor('monocolour', 'C').description)).toBe(
      "Today's are all legendary creatures that are colorless.",
    );
    expect(sentence(themeFor('guild', 'WU').description)).toBe(
      "Today's are all legendary creatures in Azorius colors.",
    );
    expect(sentence(themeFor('shard', 'WUB').description)).toBe("Today's are all legendary creatures in Esper colors.");
    expect(sentence(themeFor('shard', 'BGU').description)).toBe(
      "Today's are all legendary creatures in Sultai colors.",
    );
    expect(sentence(themeFor('tribe', 'Minotaur').description)).toBe(
      "Today's are all legendary creatures that are Minotaurs.",
    );
  });

  it('names every guild and every shard or wedge', () => {
    const named = (kind: SynergyConnectThemeKind) =>
      valuesFor(kind, pools()).map((value) => themeFor(kind, value).description);
    expect(named('guild').sort()).toEqual(
      [
        'in Azorius colors',
        'in Boros colors',
        'in Dimir colors',
        'in Golgari colors',
        'in Gruul colors',
        'in Izzet colors',
        'in Orzhov colors',
        'in Rakdos colors',
        'in Selesnya colors',
        'in Simic colors',
      ].sort(),
    );
    expect(named('shard').sort()).toEqual(
      [
        'in Abzan colors',
        'in Bant colors',
        'in Esper colors',
        'in Grixis colors',
        'in Jeskai colors',
        'in Jund colors',
        'in Mardu colors',
        'in Naya colors',
        'in Sultai colors',
        'in Temur colors',
      ].sort(),
    );
  });
});

describe('pluralizeCreatureType', () => {
  it('pluralises every tribe the current band contains', () => {
    // Spelled out rather than generated, because the point is that a human read
    // all of them once. Add a line when the band gains a type.
    const expected: Record<string, string> = {
      Bard: 'Bards',
      Beast: 'Beasts',
      Berserker: 'Berserkers',
      Citizen: 'Citizens',
      Dinosaur: 'Dinosaurs',
      Dog: 'Dogs',
      Dwarf: 'Dwarves',
      Eldrazi: 'Eldrazi',
      Faerie: 'Faeries',
      Frog: 'Frogs',
      Giant: 'Giants',
      Halfling: 'Halflings',
      Horror: 'Horrors',
      Hydra: 'Hydras',
      Minotaur: 'Minotaurs',
      Nightmare: 'Nightmares',
      Ogre: 'Ogres',
      Ooze: 'Oozes',
      Peasant: 'Peasants',
      Pirate: 'Pirates',
      Praetor: 'Praetors',
      Ranger: 'Rangers',
      Samurai: 'Samurai',
      Shapeshifter: 'Shapeshifters',
      Snake: 'Snakes',
      Sphinx: 'Sphinxes',
      Treefolk: 'Treefolk',
    };
    expect(Object.keys(expected).sort()).toEqual([...pools().tribes].sort());
    for (const [type, plural] of Object.entries(expected)) {
      expect(pluralizeCreatureType(type)).toBe(plural);
    }
  });

  /**
   * Types just outside today's band. The band is derived from a catalog that grows
   * with every set, so these are the ones that cross the floor next and they are
   * where a wrong plural would first show up on a live page.
   */
  it('handles the types just outside the band, which are the ones that join it next', () => {
    expect(pluralizeCreatureType('Elf')).toBe('Elves');
    expect(pluralizeCreatureType('Wolf')).toBe('Wolves');
    expect(pluralizeCreatureType('Fox')).toBe('Foxes');
    expect(pluralizeCreatureType('Fish')).toBe('Fish');
    expect(pluralizeCreatureType('Kor')).toBe('Kor');
    expect(pluralizeCreatureType('Moonfolk')).toBe('Moonfolk');
    expect(pluralizeCreatureType('Merfolk')).toBe('Merfolk');
    expect(pluralizeCreatureType('Fungus')).toBe('Fungi');
    expect(pluralizeCreatureType('Homunculus')).toBe('Homunculi');
    expect(pluralizeCreatureType('Octopus')).toBe('Octopuses');
    expect(pluralizeCreatureType('Vedalken')).toBe('Vedalken');
    expect(pluralizeCreatureType('Time Lord')).toBe('Time Lords');
    expect(pluralizeCreatureType('Leech')).toBe('Leeches');
    expect(pluralizeCreatureType('Harpy')).toBe('Harpies');
  });
});

describe('uncommonTribesFrom', () => {
  /** `count` legends of one type, as type lines. */
  const legends = (type: string, count: number, extra = ''): string[] =>
    Array.from({ length: count }, () => `Legendary Creature — ${type}${extra ? ` ${extra}` : ''}`);

  /**
   * Round-robin, so each type is spread evenly through the cube-count ranking
   * rather than sitting in one contiguous block. The input is ordered most-cubed
   * first and the recognisability gate reads positions off it, so a block layout
   * would put every type but the first outside the well-cubed third and the only
   * gate under test would be the count band.
   */
  const interleave = (...groups: string[][]): string[] => {
    const out: string[] = [];
    const longest = Math.max(0, ...groups.map((group) => group.length));
    for (let i = 0; i < longest; i++) {
      for (const group of groups) {
        if (i < group.length) {
          out.push(group[i]!);
        }
      }
    }
    return out;
  };

  /** A pool shaped like the real one: three ubiquitous types, three band candidates, one too thin. */
  const realisticPool = (): string[] =>
    interleave(
      legends('Human', 300),
      legends('Elf', 60),
      legends('Goblin', 45),
      legends('Minotaur', 11),
      legends('Sphinx', 14),
      legends('Treefolk', 17),
      legends('Nymph', 3),
    );

  it('keeps the uncommon types', () => {
    const tribes = uncommonTribesFrom(realisticPool());
    expect(tribes).toContain('Minotaur');
    expect(tribes).toContain('Sphinx');
    expect(tribes).toContain('Treefolk');
  });

  /**
   * The owner named these three specifically: "creatures with haste ... covers all
   * colors. It needs to be much more constrained ... an uncommon creature type",
   * and Elf, Goblin and Human were the examples of types too common to feel like a
   * theme. If a catalog shift ever puts one of them back in the band, this fails.
   */
  it('excludes the commonest types', () => {
    const tribes = uncommonTribesFrom(realisticPool());
    expect(tribes).not.toContain('Human');
    expect(tribes).not.toContain('Elf');
    expect(tribes).not.toContain('Goblin');
  });

  it('excludes types with too few legends to build four groups from', () => {
    expect(uncommonTribesFrom(realisticPool())).not.toContain('Nymph');
  });

  /**
   * `t:Rat` is a substring match, so it also returns every Pirate. A tribe whose
   * filter is wider than the tribe is dropped rather than shipped as a theme that
   * quietly is not one.
   */
  it('excludes a type whose t: filter over-matches another type', () => {
    const tribes = uncommonTribesFrom(interleave(legends('Rat', 20), legends('Pirate', 20), legends('Sphinx', 20)));
    expect(tribes).toContain('Pirate');
    expect(tribes).toContain('Sphinx');
    expect(tribes).not.toContain('Rat');
  });

  /**
   * "Legendary Creature — Time Lord Doctor" splits into three tokens, and both
   * halves of the one real two-word type would otherwise pass every gate on the
   * strength of the same cards — giving a theme called "Times".
   */
  it('merges a multi-word creature type instead of offering its halves', () => {
    const tribes = uncommonTribesFrom(interleave(legends('Time Lord', 20, 'Doctor'), legends('Sphinx', 20)));
    expect(tribes).toContain('Time Lord');
    expect(tribes).not.toContain('Time');
    expect(tribes).not.toContain('Lord');
  });

  /**
   * A type can have plenty of legends and still have none a solver would know —
   * Spider has 37 and only Ishkanah is cubed. Here every Gamer sits below the
   * well-cubed third.
   */
  it('excludes a type whose legends are all outside the well-cubed third', () => {
    // Every Gamer is ranked below every Sphinx and below the cutoff, which is what
    // Sliver, Alien, Symbiote and Time Lord all look like in the real catalog.
    const tribes = uncommonTribesFrom([
      ...interleave(legends('Human', 300), legends('Sphinx', 20)),
      ...legends('Gamer', 20),
    ]);
    expect(tribes).toContain('Sphinx');
    expect(tribes).not.toContain('Gamer');
  });

  it('ignores non-creature type lines and creatures with no subtype', () => {
    const pool = interleave(
      legends('Sphinx', 20),
      Array.from({ length: 20 }, () => 'Legendary Artifact — Equipment'),
      Array.from({ length: 20 }, () => 'Legendary Creature'),
    );
    expect(uncommonTribesFrom(pool)).toEqual(['Sphinx']);
  });

  it('is empty when the catalog is empty rather than throwing', () => {
    expect(uncommonTribesFrom([])).toEqual([]);
  });
});

describe('uncommonLegendaryTribes', () => {
  afterEach(() => clearTribePoolCache());

  /**
   * No catalog is loaded in this suite, so the real pool is empty. What matters is
   * that it degrades to "no tribe themes" rather than throwing — `drawTheme` already
   * returns null for a kind with no values, and the generator's ladder redraws.
   */
  it('is empty without a catalog, and caches that answer until cleared', () => {
    expect(uncommonLegendaryTribes()).toEqual([]);
    expect(uncommonLegendaryTribes()).toBe(uncommonLegendaryTribes());
    clearTribePoolCache();
    expect(uncommonLegendaryTribes()).toEqual([]);
  });

  it('is what themePools hands the generator', () => {
    expect(themePools()).toEqual({ tribes: uncommonLegendaryTribes() });
  });
});

describe('drawTheme', () => {
  it('is deterministic in the date and the attempt', () => {
    for (const date of manyDates(30)) {
      for (const attempt of [1, 2, 7]) {
        expect(drawTheme(date, attempt, pools())).toEqual(drawTheme(date, attempt, pools()));
      }
    }
  });

  /**
   * Never `Math.random`. Stubbing it out would catch a regression that reintroduced
   * it far more loudly than reading the source would.
   */
  it('does not touch Math.random', () => {
    const random = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must never decide a daily puzzle');
    });
    try {
      expect(() => manyDates(20).forEach((date) => drawTheme(date, 1, pools()))).not.toThrow();
    } finally {
      random.mockRestore();
    }
  });

  it('gives a different date a different draw, and a retry a fresh one', () => {
    const first = manyDates(60).map((date) => drawTheme(date, 1, pools())!.filterText);
    expect(new Set(first).size).toBeGreaterThan(10);

    // The retry ladder is only worth having if a second attempt asks a new question.
    const changed = manyDates(60).filter((date) => {
      const one = drawTheme(date, 1, pools())!;
      const two = drawTheme(date, 2, pools())!;
      return one.filterText !== two.filterText;
    });
    expect(changed.length).toBeGreaterThan(50);
  });

  it('draws all four kinds, none of them rarely', () => {
    const counts = new Map<SynergyConnectThemeKind, number>();
    for (const date of manyDates(400)) {
      const theme = drawTheme(date, 1, pools())!;
      counts.set(theme.kind, (counts.get(theme.kind) ?? 0) + 1);
    }
    for (const kind of THEME_KINDS) {
      // Uniform over kinds is 100 of 400; this is a loose floor on "the draw isn't
      // skewed", not a test of the rng's quality.
      expect(counts.get(kind) ?? 0).toBeGreaterThan(60);
    }
  });

  it('returns null rather than a broken theme when a kind has no values', () => {
    const empty: SynergyConnectThemePools = { tribes: [] };
    const drawn = manyDates(40).map((date) => drawTheme(date, 1, empty));
    // Tribe days come back null; nothing silently widens to a different kind.
    expect(drawn.filter((theme) => theme === null).length).toBeGreaterThan(0);
    for (const theme of drawn) {
      if (theme) {
        expect(theme.kind).not.toBe('tribe');
      }
    }
  });

  it('only ever returns a theme whose filter parses', () => {
    for (const date of manyDates(200)) {
      for (const attempt of [1, 2, 3]) {
        const theme = drawTheme(date, attempt, pools());
        if (theme) {
          expect(makeFilter(`${LEGENDARY_CREATURE_FILTER} ${theme.filterText}`).err).toBeFalsy();
        }
      }
    }
  });
});
