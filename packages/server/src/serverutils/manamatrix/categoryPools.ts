/**
 * Static category pools for ManaMatrix puzzle generation, ported from the
 * original implementation (GdekkerSite serverjs/manamatrix.js). All entries are
 * CubeCobra filter-syntax fragments; every generated category must parse via
 * makeFilter (enforced by tests).
 */

export const KEYWORDS = [
  'Deathtouch',
  'Defender',
  '"Double Strike"',
  'Enchant',
  'Equip',
  '"First Strike"',
  'Flash',
  'Flying',
  'Haste',
  'Hexproof',
  'Indestructible',
  'Lifelink',
  'Menace',
  'Prowess',
  'Reach',
  'Trample',
  'Vigilance',
  'Flashback',
];

export const COLORS = ['W', 'U', 'B', 'R', 'G'];

export const COLOR_COMBINATIONS = [
  ...COLORS,
  'UW',
  'UB',
  'UR',
  'UG',
  'WB',
  'WR',
  'WG',
  'BR',
  'BG',
  'RG',
  'GWU',
  'WUB',
  'WUR',
  'UBR',
  'BRG',
  'RGW',
  'RUG',
  'BUG',
  'WBG',
  'WRG',
  'WUBRG',
];

// Rules-text fragments, wrapped as o:"<fragment>" at generation time.
export const ORACLE_TERMS = [
  'destroy target',
  'exile target',
  'counter target',
  'return target',
  'creature gets',
  'creature gains',
  'until end of turn',
  'add one',
  // The 2024 errata shortened "enters the battlefield" to "enters"; the long
  // form now only matches cards with un-updated oracle text.
  'enters',
  'whenever',
  ': add',
  'for each',
  'unless',
  'up to',
  'create',
  'damage to',
  'search your library',
  'draw a card',
  'put a',
  'put it',
  'discard',
  'sacrifice',
  "can't",
  'remove',
  'reveal',
  'the beginning of',
  'you control',
  'becomes',
  'each opponent',
  'target opponent',
  'target player',
  'another',
  'where x is',
  'random order',
  'any order',
  'bottom of',
  'copy',
  'top of',
  'if you do',
  'token with',
  'permanent',
  'tapped',
  'untapped',
  "doesn't",
  'next',
  'you gain',
  'you have',
  'you lose',
  'additional cost',
  'this way',
];

export const CARD_TYPES = [
  'Artifact',
  'Creature',
  'Enchantment',
  'Instant',
  'Land',
  'Planeswalker',
  'Sorcery',
  'Legendary',
];

export const CREATURE_TYPES = [
  'Human',
  'Wizard',
  'Warrior',
  'Soldier',
  'Spirit',
  'Zombie',
  'Cleric',
  'Elemental',
  'Elf',
  'Shaman',
  'Beast',
  'Goblin',
  'Rogue',
  'Knight',
  'Vampire',
  'Bird',
  'Dragon',
  'Druid',
  'Horror',
  'Merfolk',
  'Cat',
  'Phyrexian',
  'Angel',
  'Giant',
  'Insect',
  'Construct',
  'Scout',
  'Artificer',
  'Demon',
  'Werewolf',
  'Wall',
  'Eldrazi',
  'Golem',
  'Dinosaur',
  'Shapeshifter',
  'Pirate',
  'Ogre',
  'Berserker',
  'Sliver',
  'Snake',
  'Monk',
  'Dog',
  'Faerie',
  'Dwarf',
];

// Scryfall Tagger slugs we never want as puzzle categories, even when they
// clear the frequency threshold. Curated over time; substring terms catch
// whole families of mature-content tags.
const BLOCKED_TAG_SLUGS = new Set(['removed-cards', 'reprint', 'functional-reprint']);
const BLOCKED_TAG_SUBSTRINGS = ['nud', 'sex', 'racis', 'suicid', 'slur'];

export const isTagAllowed = (slug: string): boolean => {
  if (BLOCKED_TAG_SLUGS.has(slug)) {
    return false;
  }
  return !BLOCKED_TAG_SUBSTRINGS.some((term) => slug.includes(term));
};
