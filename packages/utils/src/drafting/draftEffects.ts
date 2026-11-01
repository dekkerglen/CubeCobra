import Card from '../datatypes/Card';

/**
 * Cards from the Conspiracy sets whose text does something during the draft
 * ("draft-matters" cards). The draft engine applies their effects; this is the
 * lookup from a card to its effect, keyed by oracle id so every printing counts.
 *
 * Cards whose only draft-related text matters at game time (Worldknit, Arcane
 * Savant, Caller of the Untamed, Volatile Chimera) aren't listed: the draft
 * doesn't need to do anything for them.
 */
export type DraftEffectId =
  | 'aetherSearcher'
  | 'agent'
  | 'animus'
  | 'archdemon'
  | 'banneret'
  | 'dealBroker'
  | 'dredger'
  | 'grinder'
  | 'informant'
  | 'librarian'
  | 'loreSeeker'
  | 'operative'
  | 'palianoCity'
  | 'pickNote'
  | 'regicide'
  | 'smuggler'
  | 'spire'
  | 'spy'
  | 'tracker'
  | 'vanguard'
  | 'whispergear';

export interface DraftEffect {
  id: DraftEffectId;
  name: string;
  // Drafted face up (its ability is public and usable until it's turned face down),
  // as opposed to revealed as it's drafted.
  faceUp: boolean;
}

const effect = (id: DraftEffectId, name: string, faceUp: boolean): DraftEffect => ({ id, name, faceUp });

// Oracle id -> effect. Four cards share the "note how many cards you've drafted this round" text.
export const DRAFT_EFFECTS: Record<string, DraftEffect> = {
  '80ea63fd-691a-45ba-a4bf-862e5ec2922d': effect('aetherSearcher', 'Aether Searcher', false),
  '19047c4b-0106-455d-ab71-68cabfae7404': effect('agent', 'Agent of Acquisitions', true),
  '70ff487d-96b3-4322-9975-59bf3c6b517f': effect('animus', 'Animus of Predation', true),
  '6ca0078f-d6b5-4643-b801-e7a98706f21c': effect('archdemon', 'Archdemon of Paliano', true),
  'bb6bda0d-ddb8-47fa-be07-bbcd73a52830': effect('dredger', 'Canal Dredger', true),
  'f10898a5-87ec-4a30-a383-9f9bcba3e4d0': effect('grinder', 'Cogwork Grinder', true),
  'ec0d964e-ca2c-4252-8551-cf1916576653': effect('librarian', 'Cogwork Librarian', true),
  'adfd33cb-086c-48f4-b443-ba971ff43684': effect('spy', 'Cogwork Spy', false),
  'c60ba5e9-dbfa-441b-a96f-9cc7fdfd2d76': effect('tracker', 'Cogwork Tracker', false),
  'abd78909-72dc-4d36-8990-39995fd071da': effect('pickNote', 'Custodi Peacekeeper', false),
  '1269f7dc-a5d6-48e9-8887-b581ce38c204': effect('dealBroker', 'Deal Broker', true),
  '8ddbb63c-7f52-431b-bb82-e020b1c3749a': effect('pickNote', 'Garbage Fire', false),
  '5e8c6894-c9ad-4a50-af13-c2d95395c71e': effect('informant', 'Illusionary Informant', true),
  '8fedb2c2-fb13-4af1-b85e-714832562da7': effect('operative', "Leovold's Operative", true),
  '19a3c505-b180-47cc-bef3-9e807a8a4a3d': effect('loreSeeker', 'Lore Seeker', false),
  '412fbf73-a471-42ad-83fe-14f19e4e9595': effect('pickNote', 'Lurking Automaton', false),
  '96d88811-d0d8-4c64-b7f2-8304d81c8cfa': effect('banneret', 'Noble Banneret', true),
  'cf682012-de36-4ab4-ad94-c3c0fd7bce3f': effect('palianoCity', 'Paliano, the High City', false),
  '6dd3be81-b6dc-42ee-9e0a-2e39e3f4e793': effect('vanguard', 'Paliano Vanguard', true),
  '6ea507d3-2b8d-4f08-824c-0de0ae214da5': effect('pickNote', 'Pyretic Hunter', false),
  'db8e3c05-12d6-41f6-8cc7-e64c863fca58': effect('regicide', 'Regicide', false),
  'dc90b4aa-ba5e-4188-939d-b3920bd9ab0d': effect('smuggler', 'Smuggler Captain', true),
  'd5fc017a-7517-4737-ad5b-cc45f1e139ea': effect('spire', 'Spire Phantasm', false),
  'e40daee2-f9e6-489f-b3dd-274e5a6b8604': effect('whispergear', 'Whispergear Sneak', true),
};

export const LORE_SEEKER_ORACLE_ID = '19a3c505-b180-47cc-bef3-9e807a8a4a3d';

export const draftEffectOf = (card: Card | undefined | null): DraftEffect | null =>
  (card?.details?.oracle_id && DRAFT_EFFECTS[card.details.oracle_id]) || null;

export const isLoreSeeker = (card: Card | undefined | null): boolean =>
  card?.details?.oracle_id === LORE_SEEKER_ORACLE_ID;

// The keywords Animus of Predation can take from a removed creature.
export const ANIMUS_KEYWORDS = [
  'Flying',
  'First strike',
  'Double strike',
  'Deathtouch',
  'Haste',
  'Hexproof',
  'Indestructible',
  'Lifelink',
  'Menace',
  'Reach',
  'Vigilance',
];
