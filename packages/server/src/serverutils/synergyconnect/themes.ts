import { makeFilter } from '@utils/filtering/FilterCards';
import seedrandom from 'seedrandom';
import { searchAllCards } from 'serverutils/tools';

/**
 * The pool every Synergy Connect puzzle narrows from. A *substring* match, so it
 * covers "Legendary Creature — X" and not "Legendary Artifact Creature — X"; the
 * game has always worked that way and the tribe derivation has to agree with it.
 */
export const LEGENDARY_CREATURE_FILTER = 't:"legendary creature"';

/**
 * What a day's Synergy Connect puzzle is *about*.
 *
 * The pool this draws from replaces an earlier one of colour identities, keywords
 * and sets. Keywords were the problem: "legendary creatures with Haste" is around
 * seven hundred cards spanning all five colours, so the four groups had nothing
 * in common a solver could name and the theme did no work. Every kind here is a
 * closed, recognisable slice of the card pool instead — one colour, one guild,
 * one shard or wedge, or one uncommon creature type.
 */
export type SynergyConnectThemeKind = 'monocolour' | 'guild' | 'shard' | 'tribe';

export interface SynergyConnectTheme {
  kind: SynergyConnectThemeKind;
  /** The drawn value: 'W', 'WU', 'GWU' or 'Minotaur'. */
  value: string;
  /** Appended to `t:"legendary creature"` to make the day's card pool. */
  filterText: string;
  /** Completes the sentence "legendary creatures ___" wherever the theme is shown. */
  description: string;
}

/**
 * COLOUR IDENTITY IS MATCHED EXACTLY, never "within".
 *
 * `ci=WU` is set equality; `ci:WU` is `ci<=WU`, which would fold every mono-white
 * and mono-blue legend — and every colourless one — into "Azorius". That is the
 * breadth this whole pool exists to remove, and the same distinction already
 * caused a bug in the ManaMatrix port, so it is stated here rather than left to
 * the grammar. See `reversedSetOperation` in packages/utils/nearley/values.ne.
 */
const colourIdentityFilter = (letters: string): string => `ci=${letters.toLowerCase()}`;

/**
 * One colour each, plus colourless. Colourless is in the pool because an exact
 * `ci=c` is genuinely a mono-identity — the Eldrazi titans and the other legends
 * printed with no coloured mana — and it is the only way those cards ever anchor a
 * day. It is the thinnest theme in the whole pool at 17 legends, comfortably past
 * `MIN_COMMANDERS`, and it builds on every date sampled; if a catalog ever left it
 * short the generator rejects the draw and the ladder moves on.
 */
const MONOCOLOURS: readonly { value: string; description: string }[] = [
  { value: 'W', description: 'in mono-white' },
  { value: 'U', description: 'in mono-blue' },
  { value: 'B', description: 'in mono-black' },
  { value: 'R', description: 'in mono-red' },
  { value: 'G', description: 'in mono-green' },
  { value: 'C', description: 'that are colorless' },
];

/** The ten two-colour identities, by guild name. */
const GUILDS: readonly { value: string; name: string }[] = [
  { value: 'WU', name: 'Azorius' },
  { value: 'UB', name: 'Dimir' },
  { value: 'BR', name: 'Rakdos' },
  { value: 'RG', name: 'Gruul' },
  { value: 'GW', name: 'Selesnya' },
  { value: 'WB', name: 'Orzhov' },
  { value: 'UR', name: 'Izzet' },
  { value: 'BG', name: 'Golgari' },
  { value: 'RW', name: 'Boros' },
  { value: 'GU', name: 'Simic' },
];

/**
 * The ten three-colour identities: the five Alara shards and the five Khans
 * wedges. One kind rather than two, because a solver doesn't experience "allied
 * triple" and "enemy triple" as different questions — both are "these four
 * legends share exactly these three colours".
 */
const SHARDS: readonly { value: string; name: string }[] = [
  { value: 'GWU', name: 'Bant' },
  { value: 'WUB', name: 'Esper' },
  { value: 'UBR', name: 'Grixis' },
  { value: 'BRG', name: 'Jund' },
  { value: 'RGW', name: 'Naya' },
  { value: 'WBG', name: 'Abzan' },
  { value: 'URW', name: 'Jeskai' },
  { value: 'BGU', name: 'Sultai' },
  { value: 'RWB', name: 'Mardu' },
  { value: 'GUR', name: 'Temur' },
];

/**
 * Creature types whose English plural isn't the singular plus -s, either because
 * English says so or because Magic does.
 *
 * Only the types that can actually be drawn need to be here, but the near-band
 * ones are included too: the band is derived from a catalog that grows with every
 * set, so a type sitting just under the floor today is a type that crosses it
 * later, and a wrong plural is a copy bug on a live game that no test can see.
 */
const IRREGULAR_PLURALS: Record<string, string> = {
  // Invariant in Magic's own usage.
  Eldrazi: 'Eldrazi',
  Kor: 'Kor',
  Samurai: 'Samurai',
  Kithkin: 'Kithkin',
  Vedalken: 'Vedalken',
  Astartes: 'Astartes',
  Efreet: 'Efreet',
  Fish: 'Fish',
  // Latin plurals Magic keeps. Octopus is deliberately absent: Magic says
  // Octopuses, which the -s rule below already gets right.
  Fungus: 'Fungi',
  Homunculus: 'Homunculi',
  Nautilus: 'Nautili',
  // -f stems.
  Elf: 'Elves',
  Dwarf: 'Dwarves',
  Wolf: 'Wolves',
  Werewolf: 'Werewolves',
};

/**
 * The plural of a creature type, for "legendary creatures that are ___".
 *
 * `-folk` types are invariant — Treefolk, Moonfolk, Merfolk — which is a rule
 * rather than three entries above, because "folk" is the plural already.
 */
export const pluralizeCreatureType = (type: string): string => {
  const irregular = IRREGULAR_PLURALS[type];
  if (irregular) {
    return irregular;
  }
  if (/folk$/i.test(type)) {
    return type;
  }
  if (/(s|x|z|ch|sh)$/i.test(type)) {
    return `${type}es`;
  }
  if (/[^aeiou]y$/i.test(type)) {
    return `${type.slice(0, -1)}ies`;
  }
  return `${type}s`;
};

/** A filter value only needs quoting when it has a space in it; "Time Lord" is the only one today. */
const quoted = (value: string): string => (/\s/.test(value) ? `"${value}"` : value);

/**
 * The creature types a puzzle may be themed on, derived from the catalog rather
 * than listed here — see `uncommonLegendaryTribes`.
 */
export interface SynergyConnectThemePools {
  tribes: string[];
}

/**
 * Legendary creatures a tribe must have before it can be a theme.
 *
 * Ten, and it is `MIN_COMMANDERS` in generate.ts as well so a tribe that clears
 * the band always clears the generator's own floor.
 *
 * Measured over 40 dates per tribe: at a floor of 10 every one of the 27 tribes
 * in the band built 40/40, and at 8 the band gains four more of which Kor (9
 * legends) drops to 31/40 — nine legends is not enough bodies to find four with
 * near-disjoint synergy pools. Ten also happens to be what lets Minotaur in at 11,
 * which is the example the owner reached for, and thin tribes turn out to be the
 * *easiest* kind rather than the hardest: see COMMANDER_POOL_SIZE in generate.ts
 * for why variety beats depth in this search.
 */
const MIN_TRIBE_LEGENDS = 10;

/**
 * Legendary creatures a tribe may have before it stops feeling like a theme.
 *
 * Forty. The owner's complaint named Human, Elf and Goblin as types too ubiquitous
 * to read as a restriction, and they sit at 1175, 142 and 55 legendary creatures
 * respectively, so the cap has to be under 55 to honour that. Forty is where the
 * list stops containing anything a player would call a default: the ten commonest
 * types (Human 1175, Wizard 256, Warrior 256, Soldier 159, Elf 142, Noble 142,
 * Spirit 127, Dragon 127, Rogue 114, Mutant 96) are all far above it, and the
 * types just under it — Horror, Spider, Dinosaur, Halfling, Dwarf, Pirate — are
 * the sort of thing a solver notices as a theme.
 *
 * Absolute rather than a percentile because the distribution is extremely
 * long-tailed (one type at 1175, 44 types with a single legend), so every
 * percentile of it lands somewhere arbitrary. It does mean this needs revisiting
 * as the catalog grows; `excludesTheCommonestTribes` in the test pins the intent.
 */
const MAX_TRIBE_LEGENDS = 40;

/**
 * How many of a tribe's legends must be well-cubed for it to be worth a day.
 *
 * The puzzle picks its anchors from the most-cubed legends in the theme so that
 * solvers recognise them, and a tribe can satisfy the count floor entirely with
 * cards nobody has played: every Sliver legend is outside the 1400 most-cubed
 * legendary creatures, and Time Lord, Alien, Symbiote and Performer are all worse.
 * Requiring four of the tribe's legends inside the most-cubed third keeps the
 * four groups nameable. Four rather than more because that is exactly how many
 * groups there are.
 *
 * This is the gate that does the most work after the count band. It is what keeps
 * out Spider (37 legends, but only Ishkanah is cubed), Detective, Scientist,
 * Performer, Rebel, Sliver, Alien, Symbiote and Time Lord — all of which clear the
 * count band comfortably and would each have produced a day of four cards a cube
 * player has never seen.
 */
const MIN_CUBED_TRIBE_LEGENDS = 4;
const CUBED_LEGEND_FRACTION = 1 / 3;

/** The whitespace-separated subtypes of a type line, or [] for a non-creature. */
const subtypeTokens = (typeLine: string): string[] => {
  if (!typeLine.includes('Creature')) {
    return [];
  }
  const parts = typeLine.split('—');
  if (parts.length < 2) {
    return [];
  }
  return parts[1]!.trim().split(/\s+/).filter(Boolean);
};

/**
 * Subtypes that are one type spelled with a space, merged back together.
 *
 * Splitting a type line on whitespace turns "Time Lord" into "Time" and "Lord",
 * and both would otherwise pass every check below on the strength of the 29 Doctor
 * Who legends — giving a theme called "Times". Detected rather than listed: a pair
 * is one type when every occurrence of the first word is immediately followed by
 * the second and every occurrence of the second is immediately preceded by the
 * first. Over the current catalog that finds exactly `Time Lord`, and it keeps
 * finding whatever the next one is.
 */
const mergedMultiWordTypes = (typeLines: string[]): Map<string, string> => {
  const successors = new Map<string, Set<string>>();
  const predecessors = new Map<string, Set<string>>();
  const add = (index: Map<string, Set<string>>, key: string, value: string): void => {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(value);
  };

  for (const typeLine of typeLines) {
    const tokens = subtypeTokens(typeLine);
    tokens.forEach((token, i) => {
      add(successors, token, tokens[i + 1] ?? ' end');
      add(predecessors, token, i === 0 ? ' start' : tokens[i - 1]!);
    });
  }

  const merges = new Map<string, string>();
  for (const [first, follows] of successors) {
    if (follows.size !== 1) {
      continue;
    }
    const [second] = [...follows];
    if (!second || second.startsWith(' ')) {
      continue;
    }
    const precedes = predecessors.get(second)!;
    if (precedes.size !== 1 || !precedes.has(first)) {
      continue;
    }
    merges.set(first, `${first} ${second}`);
    merges.set(second, `${first} ${second}`);
  }
  return merges;
};

/**
 * Creature types that are distinctive enough to be a day's theme.
 *
 * Takes the legendary creature pool as an argument, most-cubed first, so the
 * derivation can be tested against a hand-built pool rather than only against
 * whatever the catalog happens to hold — the same reason `chooseTheme` in the
 * crossword's schedule.ts takes its pools and its depth probe as arguments.
 *
 * Three gates, in the order they are cheapest to apply:
 *
 *  1. Count. Between `MIN_TRIBE_LEGENDS` and `MAX_TRIBE_LEGENDS` legendary
 *     creatures — enough to build a puzzle from, few enough to feel chosen.
 *  2. Recognisability. See `MIN_CUBED_TRIBE_LEGENDS`.
 *  3. Faithfulness. `t:Rat` is a *substring* match on the type line (see
 *     `stringContainOperation`), so it also matches every Pirate; `t:Ape` matches
 *     every Shapeshifter and `t:Orc` every Sorcerer. A type whose substring match
 *     is wider than its real membership is dropped rather than silently widened,
 *     since a theme that quietly includes 28 Pirates is the original complaint
 *     again. Today this drops Rat, Orc, Monk, Wolf, Fish and Ape.
 */
export const uncommonTribesFrom = (legendTypeLinesByCubeCount: string[]): string[] => {
  const typeLines = legendTypeLinesByCubeCount;
  const merges = mergedMultiWordTypes(typeLines);
  const typesOf = (typeLine: string): string[] => [
    ...new Set(subtypeTokens(typeLine).map((token) => merges.get(token) ?? token)),
  ];

  const total = new Map<string, number>();
  const cubed = new Map<string, number>();
  const cubedCutoff = Math.ceil(typeLines.length * CUBED_LEGEND_FRACTION);
  typeLines.forEach((typeLine, index) => {
    for (const type of typesOf(typeLine)) {
      total.set(type, (total.get(type) ?? 0) + 1);
      if (index < cubedCutoff) {
        cubed.set(type, (cubed.get(type) ?? 0) + 1);
      }
    }
  });

  const lowerLines = typeLines.map((typeLine) => typeLine.toLowerCase());
  const substringMatches = (type: string): number => {
    const needle = type.toLowerCase();
    let count = 0;
    for (const line of lowerLines) {
      if (line.includes(needle)) {
        count += 1;
      }
    }
    return count;
  };

  return [...total.entries()]
    .filter(([, count]) => count >= MIN_TRIBE_LEGENDS && count <= MAX_TRIBE_LEGENDS)
    .filter(([type]) => (cubed.get(type) ?? 0) >= MIN_CUBED_TRIBE_LEGENDS)
    .filter(([type, count]) => substringMatches(type) === count)
    .map(([type]) => type)
    .sort();
};

let cachedTribes: string[] | undefined;

/**
 * The tribe pool for the loaded catalog, built once per process.
 *
 * The legend list is read through EXACTLY the filter and distinctness the puzzle
 * itself uses. Counting printings instead was tried and is wildly wrong — 10,491
 * rather than 2,880 — and it also silently disagrees about membership:
 * `t:"legendary creature"` is a substring match, so a Legendary *Artifact*
 * Creature is not in the game's pool at all, and a tribe scored on printings can
 * pass every gate and then return zero cards (Construct and Golem both did).
 */
export const uncommonLegendaryTribes = (): string[] => {
  if (cachedTribes) {
    return cachedTribes;
  }

  const start = Date.now();
  const { filter } = makeFilter(LEGENDARY_CREATURE_FILTER);
  const legends = filter ? searchAllCards(filter, 'Cube Count', 'descending', 'names') : [];
  const tribes = uncommonTribesFrom(legends.map((card) => card.type));

  console.info(
    `Synergy Connect tribe pool built in ${Date.now() - start}ms from ${legends.length} legendary creatures: ${tribes.length} types (${tribes.join(', ')})`,
  );

  cachedTribes = tribes;
  return tribes;
};

/** Test seam: drop the cache so a rebuilt catalog is re-scanned. */
export const clearTribePoolCache = (): void => {
  cachedTribes = undefined;
};

export const themePools = (): SynergyConnectThemePools => ({ tribes: uncommonLegendaryTribes() });

/**
 * The filter and the wording for one (kind, value).
 *
 * Every description completes "legendary creatures ___", which is how both the
 * game page and the dashboard card render it. None of them says "commander":
 * this is not a commander game, whatever the internal field names still say.
 */
export const themeFor = (kind: SynergyConnectThemeKind, value: string): SynergyConnectTheme => {
  switch (kind) {
    case 'monocolour': {
      const mono = MONOCOLOURS.find((entry) => entry.value === value);
      return {
        kind,
        value,
        filterText: colourIdentityFilter(value),
        description: mono?.description ?? `in ${value}`,
      };
    }
    case 'guild': {
      const guild = GUILDS.find((entry) => entry.value === value);
      return {
        kind,
        value,
        filterText: colourIdentityFilter(value),
        description: `in ${guild?.name ?? value} colors`,
      };
    }
    case 'shard': {
      const shard = SHARDS.find((entry) => entry.value === value);
      return {
        kind,
        value,
        filterText: colourIdentityFilter(value),
        description: `in ${shard?.name ?? value} colors`,
      };
    }
    case 'tribe':
      return {
        kind,
        value,
        filterText: `t:${quoted(value)}`,
        description: `that are ${pluralizeCreatureType(value)}`,
      };
  }
};

/** The values one kind may draw from. */
export const valuesFor = (kind: SynergyConnectThemeKind, pools: SynergyConnectThemePools): string[] => {
  switch (kind) {
    case 'monocolour':
      return MONOCOLOURS.map((mono) => mono.value);
    case 'guild':
      return GUILDS.map((guild) => guild.value);
    case 'shard':
      return SHARDS.map((shard) => shard.value);
    case 'tribe':
      return pools.tribes;
  }
};

/**
 * The four kinds, drawn from uniformly.
 *
 * Uniform over *kinds* rather than over values: there are six monocolours, ten
 * guilds, ten shards and around fifty tribes, so drawing a value uniformly would
 * make five days in six a tribe day. A quarter each keeps the week varied.
 */
export const THEME_KINDS: readonly SynergyConnectThemeKind[] = ['monocolour', 'guild', 'shard', 'tribe'];

/**
 * Every theme the pool can produce, so a test can prove all of them parse over
 * the whole pool rather than over whichever values a few dates happened to draw.
 */
export const enumerateThemes = (pools: SynergyConnectThemePools): SynergyConnectTheme[] =>
  THEME_KINDS.flatMap((kind) => valuesFor(kind, pools).map((value) => themeFor(kind, value)));

/**
 * The theme for one (date, attempt).
 *
 * Deterministic in the date and the attempt and nothing else — `seedrandom` off a
 * string built from both, never `Math.random`, so re-running a date rebuilds the
 * same puzzle. `attempt` exists because a narrow theme can fail to yield four
 * legends with distinct enough synergies, and the fix for that is a fresh theme
 * rather than a fresh shuffle of the same one; see the retry loop in generate.ts.
 *
 * Returns null only when the kind it drew has no usable values, which for tribes
 * means the catalog isn't loaded.
 */
export const drawTheme = (
  date: string,
  attempt: number,
  pools: SynergyConnectThemePools,
): SynergyConnectTheme | null => {
  const rng = seedrandom(`${date}:synergyconnect-theme:${attempt}`);
  const kind = THEME_KINDS[Math.floor(rng() * THEME_KINDS.length)]!;
  const values = valuesFor(kind, pools);
  if (values.length === 0) {
    return null;
  }
  const value = values[Math.floor(rng() * values.length)]!;
  const theme = themeFor(kind, value);
  // A pool read off the catalog can contain anything, so the grammar gets the
  // last word before the theme is used.
  return makeFilter(theme.filterText).err ? null : theme;
};
