// Reminder text for Magic keyword abilities, keyword actions, and ability words.
//
// Scryfall card objects expose a `keywords: string[]` array (see cardKeywords in
// @utils/cardutil), but they do NOT carry per-keyword reminder text. This module is a
// curated static reference so the Keywords analysis page can show a quick description of
// what each mechanic does. It covers the evergreen and commonly-recurring keywords; rarer
// set-specific mechanics that aren't listed here simply render without reminder text.
//
// Reminder text is generalized for parameterized keywords (e.g. Ward, Annihilator): the
// literal cost/number is replaced with "[cost]" or "N" since it varies per card.

const KEYWORD_REMINDER_TEXT: Record<string, string> = {
  // ─── Evergreen ──────────────────────────────────────────────────────────────
  deathtouch: 'Any amount of damage this deals to a creature is enough to destroy it.',
  defender: "This creature can't attack.",
  'double strike': 'This creature deals both first-strike and regular combat damage.',
  enchant: 'This can only be attached to the stated permanent, and moves to the graveyard if that permanent leaves play.',
  equip: 'Attach this Equipment to target creature you control. Equip only as a sorcery.',
  'first strike': 'This creature deals combat damage before creatures without first strike.',
  flash: 'You may cast this spell any time you could cast an instant.',
  flying: 'This creature can only be blocked by creatures with flying or reach.',
  haste: 'This creature can attack and use tap abilities as soon as it comes under your control.',
  hexproof: "This permanent can't be the target of spells or abilities your opponents control.",
  indestructible: "This permanent can't be destroyed by damage or effects that say \"destroy\".",
  lifelink: 'Damage dealt by this creature also causes you to gain that much life.',
  menace: "This creature can't be blocked except by two or more creatures.",
  protection: "This permanent can't be blocked, targeted, dealt damage, enchanted, or equipped by anything with the stated quality.",
  prowess: 'Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.',
  reach: 'This creature can block creatures with flying.',
  trample: 'This creature can assign excess combat damage to the player or planeswalker it is attacking.',
  vigilance: "Attacking doesn't cause this creature to tap.",
  ward: 'Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost.',

  // ─── Keyword actions ──────────────────────────────────────────────────────────
  scry: 'Look at the top N cards of your library, then put any number of them on the bottom and the rest back on top in any order.',
  surveil: 'Look at the top N cards of your library, then put any number of them into your graveyard and the rest back on top in any order.',
  fight: 'Each of the two creatures deals damage equal to its power to the other.',
  explore: 'Reveal the top card of your library. Put a +1/+1 counter on this creature if it was a nonland card; otherwise put that card into your hand or leave it on top.',
  amass: "Put N +1/+1 counters on an Army you control, or create a 0/0 black Army creature token first if you don't have one.",
  connive: 'Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature.',
  goad: 'Until your next turn, the goaded creature attacks each combat if able, and attacks a player other than you if able.',
  proliferate: 'Choose any number of permanents and/or players with a counter, then give each another counter of a kind already there.',
  populate: 'Create a token that\'s a copy of a creature token you control.',
  bolster: 'Put N +1/+1 counters on the creature you control with the least toughness.',
  support: 'Put a +1/+1 counter on each of up to N target creatures.',
  monstrosity: "Put N +1/+1 counters on this creature and it becomes monstrous. Can't be activated if it's already monstrous.",
  adapt: "If this creature has no +1/+1 counters on it, put N +1/+1 counters on it.",
  investigate: 'Create a Clue token — an artifact with "{2}, Sacrifice this artifact: Draw a card."',
  detain: "Until your next turn, the detained permanent can't attack or block and its activated abilities can't be activated.",
  manifest: 'Put the top card of your library onto the battlefield face down as a 2/2 creature. Turn it face up any time for its mana cost if it\'s a creature card.',
  transform: 'Turn this double-faced permanent to its other face.',
  meld: 'Combine this card with its meld partner into a single oversized permanent.',
  clash: 'Reveal the top card of your library. A player who reveals a higher-mana-value card wins the clash.',

  // ─── Common keyword abilities ─────────────────────────────────────────────────
  flashback: 'You may cast this card from your graveyard for its flashback cost, then exile it.',
  cycling: 'Discard this card and pay the cycling cost: Draw a card.',
  kicker: 'You may pay an additional cost as you cast this spell for an extra effect.',
  multikicker: 'You may pay the kicker cost any number of times as you cast this spell.',
  buyback: 'You may pay an additional cost; if you do, return this spell to your hand as it resolves instead of putting it in the graveyard.',
  convoke: 'Your creatures can help cast this spell. Each tapped creature pays for {1} or one mana of its color.',
  delve: 'Each card you exile from your graveyard as you cast this spell pays for {1}.',
  affinity: 'This spell costs {1} less to cast for each of the stated permanent you control.',
  cascade: 'When you cast this spell, exile cards from the top of your library until you exile a cheaper nonland card, then you may cast it for free.',
  storm: 'When you cast this spell, copy it for each spell cast before it this turn.',
  suspend: 'Rather than cast this card from your hand, you may pay its suspend cost and exile it with N time counters. Cast it for free when the last is removed.',
  echo: 'At the beginning of your upkeep, if this came under your control since your last upkeep, sacrifice it unless you pay its echo cost.',
  madness: 'If you discard this card, you may cast it for its madness cost instead of putting it into your graveyard.',
  morph: 'You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.',
  megamorph: 'You may cast this face down as a 2/2 for {3}. Turn it face up for its megamorph cost, and it gets a +1/+1 counter.',
  unearth: 'You may pay the unearth cost to return this card from your graveyard to the battlefield. It gains haste, then is exiled at end of turn.',
  dredge: 'If you would draw a card, you may instead mill N cards and return this from your graveyard to your hand.',
  overload: 'You may cast this spell for its overload cost. If you do, change "target" to "each".',
  miracle: 'You may cast this for its miracle cost when you draw it if it\'s the first card you drew this turn.',
  bloodthirst: 'If an opponent was dealt damage this turn, this creature enters with N +1/+1 counters.',
  bestow: 'You may cast this card for its bestow cost as an Aura. It becomes a creature again if it becomes unattached.',
  soulbond: 'You may pair this creature with another unpaired creature when either enters; they share a bonus while paired.',
  extort: 'Whenever you cast a spell, you may pay {W/B} to drain each opponent for 1 life.',
  evolve: 'Whenever a creature you control enters with greater power or toughness, put a +1/+1 counter on this creature.',
  outlast: 'Tap this creature: Put a +1/+1 counter on it. Outlast only as a sorcery.',
  ferocious: 'Grants a bonus if you control a creature with power 4 or greater.',
  raid: 'Grants a bonus if you attacked this turn.',
  formidable: 'Grants a bonus if creatures you control have total power 8 or greater.',
  dash: 'You may cast this creature for its dash cost. It gains haste, then returns to your hand at end of turn.',
  exploit: 'When this creature enters, you may sacrifice a creature for an additional effect.',
  awaken: 'You may cast this for its awaken cost to also put N +1/+1 counters on a land and make it a creature.',
  ingest: 'Whenever this creature deals combat damage to a player, that player exiles the top card of their library.',
  devoid: 'This card has no color.',
  emerge: 'You may cast this spell by sacrificing a creature and paying the emerge cost reduced by that creature\'s mana value.',
  escalate: 'Pay the escalate cost for each mode chosen beyond the first.',
  crew: 'Tap any number of creatures with total power N or more to turn this Vehicle into an artifact creature until end of turn.',
  fabricate: 'When this creature enters, put N +1/+1 counters on it or create N 1/1 Servo artifact tokens.',
  improvise: 'Your artifacts can help cast this spell. Each tapped artifact pays for {1}.',
  revolt: 'Grants a bonus if a permanent you controlled left the battlefield this turn.',
  embalm: 'You may exile this card from your graveyard and pay its embalm cost to create a token copy of it. The token is white and has no mana cost.',
  eternalize: 'Exile this card from your graveyard and pay its eternalize cost to create a 4/4 black token copy of it.',
  afflict: 'Whenever this creature becomes blocked, defending player loses N life.',
  'aftermath': 'You may cast the aftermath half of this split card only from your graveyard, then exile it.',
  jump_start: 'You may cast this card from your graveyard by also discarding a card, then exile it.',
  jumpstart: 'You may cast this card from your graveyard by also discarding a card, then exile it.',
  mentor: 'Whenever this creature attacks, put a +1/+1 counter on a target attacking creature with lesser power.',
  undergrowth: 'Grants a bonus based on the number of creature cards in your graveyard.',
  spectacle: 'You may cast this for its spectacle cost if an opponent lost life this turn.',
  riot: 'This creature enters with your choice of a +1/+1 counter or haste.',
  adamant: 'Grants a bonus if at least three mana of the same color was spent to cast this spell.',
  addendum: 'Grants a bonus if you cast this spell during your main phase.',
  escape: 'You may cast this card from your graveyard for its escape cost, which includes exiling cards from your graveyard.',
  mutate: 'You may cast this for its mutate cost, merging it with a target non-Human creature you own to form one mutated creature.',
  companion: 'If your deck meets this card\'s condition, you may put it into your hand from outside the game once each game for {3}.',
  cleave: 'You may cast this spell for its cleave cost, ignoring the words in square brackets.',
  daybound: 'This permanent is a day-only face; certain conditions turn the day to night and transform it.',
  nightbound: 'This permanent is a night-only face; certain conditions turn the night to day and transform it.',
  disturb: 'You may cast this card from your graveyard transformed for its disturb cost.',
  decayed: "This creature can't block, and it's sacrificed when it attacks.",
  training: 'Whenever this creature attacks with another creature of greater power, put a +1/+1 counter on this creature.',
  blitz: 'You may cast this creature for its blitz cost. It gains haste and "when this dies, draw a card," and is sacrificed at end of turn.',
  casualty: 'As you cast this spell, you may sacrifice a creature with the stated power to copy the spell.',
  enlist: 'As this creature attacks, you may tap a nonattacking creature you control to add its power to this creature.',
  reconfigure: 'Attach this Equipment creature to a creature you control, or unattach it, as a sorcery. It isn\'t a creature while attached.',
  toxic: 'A player dealt combat damage by this creature also gets N poison counters.',
  compleated: "If you pay a Phyrexian mana cost with life, this permanent enters with that many fewer counters.",
  backup: 'When this creature enters, put N +1/+1 counters on a target creature. If it\'s another creature, it also gains this creature\'s other abilities.',
  bargain: 'You may sacrifice an artifact, enchantment, or token as you cast this spell for an extra effect.',
  disguise: 'You may cast this face down as a 2/2 with ward {2} for {3}. Turn it face up any time for its disguise cost.',
  cloak: 'Put a card face down as a 2/2 creature with ward {2}. Turn it face up any time for its mana cost if it\'s a creature card.',
  plot: 'You may pay the plot cost and exile this card from your hand; cast it for free on a later turn.',
  saddle: 'Tap any number of other creatures with total power N or more to saddle this Mount. It gets a bonus while saddled and attacking.',
  gift: 'You may promise an opponent a gift as you cast this spell for an additional effect.',
  forage: 'Sacrifice three foods or exile three cards from your graveyard to pay this cost.',
  freerunning: 'You may cast this for its freerunning cost if you attacked with an Assassin or a commander this turn.',
  spree: 'Choose one or more additional costs; pay for each mode you select.',

  // ─── Ability words (no inherent rules meaning; describe the common pattern) ─────
  landfall: 'Triggers an effect whenever a land enters the battlefield under your control.',
  metalcraft: 'Grants a bonus if you control three or more artifacts.',
  threshold: 'Grants a bonus if seven or more cards are in your graveyard.',
  delirium: 'Grants a bonus if four or more card types are among cards in your graveyard.',
  'hellbent': 'Grants a bonus if you have no cards in hand.',
  imprint: 'A card exiled by this permanent grants it an ongoing effect.',
  constellation: 'Triggers an effect whenever an enchantment enters the battlefield under your control.',
  'grandeur': 'Discard another card with the same name: activate a powerful ability.',
  morbid: 'Grants a bonus if a creature died this turn.',
  'battalion': 'Triggers when this and at least two other creatures attack.',
  'bloodrush': 'Discard this card and pay its bloodrush cost to give an attacking creature a bonus.',
  channel: 'Discard this card and pay its channel cost for an effect.',
  'sweep': 'Return any number of the stated land to your hand; effects scale with the number returned.',
  domain: 'Effects scale with the number of basic land types among lands you control.',
  'fateful hour': 'Grants a bonus if you have 5 or less life.',
  'coven': 'Grants a bonus if you control three or more creatures with different powers.',
  corrupted: 'Grants a bonus if an opponent has three or more poison counters.',
  'magecraft': 'Triggers whenever you cast or copy an instant or sorcery spell.',
  pack_tactics: 'Grants a bonus if you attacked with creatures with total power 6 or greater.',
};

// Some Scryfall keywords are stored with punctuation/casing that won't match the map above.
const normalize = (keyword: string): string =>
  keyword
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

// Build a normalized lookup so "First Strike", "first-strike", etc. all resolve.
const NORMALIZED_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(KEYWORD_REMINDER_TEXT).map(([k, v]) => [normalize(k), v]),
);

export const getKeywordReminder = (keyword: string): string | undefined => NORMALIZED_MAP[normalize(keyword)];

export default KEYWORD_REMINDER_TEXT;
