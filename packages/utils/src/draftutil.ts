import { cardCmc, cardColorCategory, cardRarity, cardType, cmcColumn } from './cardutil';
import Card from './datatypes/Card';
import Draft, { CardSlot, DraftAction, DraftFormat, DraftStep, Pack } from './datatypes/Draft';
import type { State } from './datatypes/DraftState';

interface Step {
  action: string;
  amount?: number;
  pick?: number;
  cardsInPack?: number;
}

interface FlattenedStep extends Step {
  pack: number;
}

interface DrafterState {
  picked: number[];
  trashed: number[];
  pickQueue: number[];
  trashQueue: number[];
  cardsPicked: number[];
  cardsInPack: number[];
  picksList: {
    cardIndex: number;
    action: string;
    index: number;
  }[][];
  pick?: number;
  pack?: number;
  selection?: number;
  step?: Step;
}

export const flattenSteps = (steps: Step[], pack: number): FlattenedStep[] => {
  const res: FlattenedStep[] = [];
  let pick = 0;
  let cardsInPack = steps.map((step) => (step.action === 'pass' ? 0 : step.amount || 0)).reduce((a, b) => a + b, 0) + 1;

  for (const step of steps) {
    if (step.amount) {
      for (let i = 0; i < step.amount; i++) {
        if (step.action !== 'pass') {
          pick += 1;
          cardsInPack -= 1;

          res.push({
            pick,
            action: step.action,
            cardsInPack,
            amount: step.amount - i,
            pack,
          });
        } else {
          res.push({
            pick,
            action: step.action,
            cardsInPack: cardsInPack - 1,
            pack,
          });
        }
      }
    } else if (step.action !== 'pass') {
      pick += 1;
      cardsInPack -= 1;

      res.push({
        pick,
        action: step.action,
        cardsInPack,
        amount: 1,
        pack,
      });
    } else {
      res.push({
        pick,
        action: step.action,
        cardsInPack: cardsInPack - 1,
        pack,
      });
    }
  }
  return res;
};

export const defaultStepsForLength = (length: number): Step[] => {
  const steps: DraftStep[] = new Array(length)
    .fill([
      { action: 'pick', amount: 1 },
      { action: 'pass', amount: 1 },
    ])
    .flat();

  return normalizeDraftSteps(steps).map((step) => ({
    action: step.action,
    //We know not null here
    amount: step.amount!,
  }));
};

export const getStepList = (initialState: any[]): FlattenedStep[] =>
  initialState[0]
    .map((pack: any, packIndex: number) => [
      ...flattenSteps(pack.steps || defaultStepsForLength(pack.cards.length), packIndex),
      {
        pack: packIndex + 1,
        action: 'endpack',
      },
    ])
    .flat();

export const getDrafterState = (draft: Draft, seatNumber: number, pickNumber: number): DrafterState => {
  if (!draft.InitialState) {
    return {
      picked: [],
      trashed: [],
      pickQueue: [],
      trashQueue: [],
      cardsPicked: [],
      cardsInPack: [],
      picksList: [],
    };
  }

  // build list of steps and match to pick and pack number
  const steps = getStepList(draft.InitialState);

  // build a list of states for each seat
  const states: DrafterState[] = [];
  for (let i = 0; i < draft.seats.length; i++) {
    const picksList: any[] = [];
    const seat = draft.seats[i];
    if (!seat) continue;

    const pickQueue = (seat.pickorder || []).slice();
    const trashQueue = (seat.trashorder || []).slice();
    let index = 0;

    for (let j = 0; j < steps.length; j++) {
      const step = steps[j];
      if (!step) continue;

      if (!picksList[step.pack]) {
        picksList[step.pack] = [];
      }

      if (step.action === 'pick' || step.action === 'pickrandom') {
        picksList[step.pack].push({ action: step.action, cardIndex: pickQueue.pop(), index });
        index += 1;
      } else if (step.action === 'trash' || step.action === 'trashrandom') {
        picksList[step.pack].push({ action: step.action, cardIndex: trashQueue.pop(), index });
        index += 1;
      }
    }

    states.push({
      picked: [],
      trashed: [],
      pickQueue: (seat.pickorder || []).slice(),
      trashQueue: (seat.trashorder || []).slice(),
      cardsPicked: [...seat.mainboard.flat(3), ...seat.sideboard.flat(3)],
      cardsInPack: [],
      picksList,
    });
  }

  // setup some useful context variables
  let packsWithCards: any[] = [];
  let offset = 0;

  // go through steps and update states
  for (const step of steps) {
    // open pack if we need to open a new pack
    if (step.pick === 1 && step.action !== 'pass') {
      packsWithCards = [];

      for (let i = 0; i < draft.InitialState.length; i++) {
        const seatState = draft.InitialState[i];
        const packState = seatState?.[step.pack];
        if (packState?.cards) {
          packsWithCards[i] = packState.cards.slice();
        }
      }

      offset = 0;
    }

    // perform the step if it's not a pass
    for (let i = 0; i < states.length; i++) {
      const seat = states[i];
      if (!seat) continue;

      seat.pick = step.pick;
      seat.pack = step.pack;

      if (step.action === 'pick' || step.action === 'pickrandom') {
        seat.cardsInPack = packsWithCards[(i + offset) % draft.seats.length].slice();

        let picked = seat.pickQueue.pop();

        if (picked === -1) {
          // try to make picked a card in the pack that exists in cardsPicked
          for (const cardIndex of seat.cardsInPack) {
            if (seat.cardsPicked.includes(cardIndex)) {
              picked = cardIndex;
              break;
            }
          }
        }

        seat.picked.push(picked || -1);
        seat.selection = picked;
        seat.step = step;

        // remove this card from the pack
        packsWithCards[(i + offset) % states.length] = packsWithCards[(i + offset) % states.length].filter(
          (card: number) => card !== picked,
        );
      } else if (step.action === 'trash' || step.action === 'trashrandom') {
        seat.cardsInPack = packsWithCards[(i + offset) % states.length].slice();
        const trashed = seat.trashQueue.pop();
        seat.trashed.push(trashed || -1);
        seat.selection = trashed;
        seat.step = step;

        // remove this card from the pack
        packsWithCards[(i + offset) % states.length] = packsWithCards[(i + offset) % states.length].filter(
          (card: number) => card !== trashed,
        );
      }
    }

    // if we've reached the desired time in the draft, we're done
    const currentState = states[seatNumber];
    if (currentState && currentState.picked.length + currentState.trashed.length > pickNumber) {
      break;
    }

    // now if it's a pass we can pass
    if (step.action === 'pass') {
      const passLeft = step.pack % 2 === 0;
      offset = (offset + (passLeft ? 1 : states.length - 1)) % states.length;
    }
  }

  return (
    states[seatNumber] || {
      picked: [],
      trashed: [],
      pickQueue: [],
      trashQueue: [],
      cardsPicked: [],
      cardsInPack: [],
      picksList: [],
    }
  );
};

export const getDefaultPosition = (card: Card, picks: any[][][]): [number, number, number] => {
  const { row, col } = getCardDefaultRowColumn(card);
  const colIndex = picks[row]?.[col]?.length || 0;
  return [row, col, colIndex];
};

export const getCardDefaultRowColumn = (card: Card): { row: number; col: number } => {
  const isCreature = cardType(card).toLowerCase().includes('creature');
  //Some cards, like Assault//Battery, have a CMC that is a decimal (and then there are un-cards). cmcColumn normalizes between 0 and 8
  const cmc = cmcColumn(card);

  const row = isCreature ? 0 : 1;
  const col = Math.max(0, Math.min(7, cmc));

  return { row, col };
};

export const stepListToTitle = (steps: DraftStep[]): string => {
  if (steps.length <= 1) {
    return 'Finishing up draft...';
  }

  const firstStep = steps[0];
  if (!firstStep) {
    return 'Making random selection...';
  }

  if (firstStep.action === 'pick') {
    let count = 1;
    while (steps.length > count && steps[count]?.action === 'pick') {
      count += 1;
    }
    if (count > 1) {
      return `Pick ${count} more cards`;
    }
    return 'Pick one more card';
  }
  if (firstStep.action === 'trash') {
    let count = 1;
    while (steps.length > count && steps[count]?.action === 'trash') {
      count += 1;
    }
    if (count > 1) {
      return `Trash ${count} more cards`;
    }
    return 'Trash one more card';
  }
  if (firstStep.action === 'endpack') {
    return 'Waiting for next pack to open...';
  }

  return 'Making random selection...';
};

export const getCardCol: (draft: Draft, cardIndex: number) => number = (draft: Draft, cardIndex: number) => {
  const card = draft.cards[cardIndex];
  return card ? Math.max(0, Math.min(7, cardCmc(card))) : 0;
};

// Quick-sort schemes for the deckbuilder. Each key re-buckets a board's
// columns by a card attribute; the two rows always stay split into
// creatures (row 0) and non-creatures (row 1).
export type DeckSortKey = 'color' | 'cmc' | 'rarity' | 'type';

// Column order for a color sort. cardColorCategory can return 'Hybrid', which
// is folded into Multicolored below.
const DECK_COLOR_COLUMNS = ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Colorless', 'Lands'] as const;
const DECK_RARITY_COLUMNS = ['common', 'uncommon', 'rare', 'mythic', 'special'] as const;

// Number of columns produced by each sort key.
export const DECK_SORT_COLUMN_COUNT: Record<DeckSortKey, number> = {
  // Lands, then mana value 0..7+ (cmcColumn caps at 7).
  cmc: 1 + 8,
  color: DECK_COLOR_COLUMNS.length,
  rarity: DECK_RARITY_COLUMNS.length,
  // Creature, Planeswalker, Instant, Sorcery, Artifact, Enchantment, Land, Other.
  type: 8,
};

const deckSortColumn = (card: Card, key: DeckSortKey): number => {
  const typeLine = cardType(card).toLowerCase();

  switch (key) {
    case 'cmc':
      // Lands get their own leading column; everything else follows by mana value.
      return typeLine.includes('land') ? 0 : 1 + cmcColumn(card);
    case 'color': {
      const category = cardColorCategory(card);
      const index = (DECK_COLOR_COLUMNS as readonly string[]).indexOf(category);
      // Hybrid (or anything unrecognized) falls into the Multicolored column.
      return index === -1 ? DECK_COLOR_COLUMNS.indexOf('Multicolored') : index;
    }
    case 'rarity': {
      const index = (DECK_RARITY_COLUMNS as readonly string[]).indexOf(cardRarity(card).toLowerCase());
      // Unknown rarities (bonus, special, etc.) collect in the final column.
      return index === -1 ? DECK_RARITY_COLUMNS.length - 1 : index;
    }
    case 'type':
      if (typeLine.includes('creature')) return 0;
      if (typeLine.includes('planeswalker')) return 1;
      if (typeLine.includes('instant')) return 2;
      if (typeLine.includes('sorcery')) return 3;
      if (typeLine.includes('artifact')) return 4;
      if (typeLine.includes('enchantment')) return 5;
      if (typeLine.includes('land')) return 6;
      return 7;
    default:
      return 0;
  }
};

const emptyBoard = (rows: number, cols: number): number[][][] =>
  new Array(rows).fill(null).map(() => new Array(cols).fill(null).map(() => [] as number[]));

// Re-bucket a board's columns by the given card attribute. Each card keeps the
// row it's currently in — the creature / non-creature split is handled
// separately by splitDeckByCreature so the two controls are independent.
export const sortDeckIntoColumns = (board: number[][][], cards: Card[], key: DeckSortKey): number[][][] => {
  const numColumns = DECK_SORT_COLUMN_COUNT[key];
  const result = emptyBoard(Math.max(2, board.length), numColumns);

  board.forEach((row, rowIndex) => {
    for (const column of row) {
      for (const cardIndex of column) {
        const card = cards[cardIndex];
        if (!card) {
          continue;
        }
        result[rowIndex]![deckSortColumn(card, key)]!.push(cardIndex);
      }
    }
  });

  return result;
};

// Split a board into two rows — creatures (row 0) and non-creatures (row 1) —
// while keeping every card in the column it's already in.
export const splitDeckByCreature = (board: number[][][], cards: Card[]): number[][][] => {
  const numColumns = Math.max(1, ...board.map((row) => row.length));
  const result = emptyBoard(2, numColumns);

  for (const row of board) {
    row.forEach((column, colIndex) => {
      for (const cardIndex of column) {
        const card = cards[cardIndex];
        if (!card) {
          continue;
        }
        const targetRow = cardType(card).toLowerCase().includes('creature') ? 0 : 1;
        result[targetRow]![colIndex]!.push(cardIndex);
      }
    });
  }

  return result;
};

export const setupPicks: (rows: number, cols: number) => any[][][] = (rows: number, cols: number) => {
  const res = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      row.push([]);
    }
    res.push(row);
  }
  return res;
};

/**
 * Normalizes pack slots from legacy string[] format to CardSlot[] format.
 * This provides backwards compatibility with old format data stored as string arrays.
 */
export const normalizePackSlots = (pack: Pack): Pack => {
  if (!Array.isArray(pack.slots)) return pack;
  if (pack.slots.length === 0) return pack;
  // Check if slots are already CardSlot objects (have a 'filter' property)
  if (typeof pack.slots[0] === 'object' && Object.prototype.hasOwnProperty.call(pack.slots[0], 'filter')) return pack;
  // Convert string[] to CardSlot[] (backwards compat)
  pack.slots = (pack.slots as any as string[]).map((filter: string) => ({ filter }));
  return pack;
};

export const normalizeDraftFormatSteps = (format: DraftFormat): DraftFormat => {
  if (!Array.isArray((format as any).packs)) return format;
  for (let packNum = 0; packNum < format.packs.length; packNum++) {
    const pack = format.packs[packNum];
    if (!pack) continue;

    // Normalize slots (backwards compat: string[] -> CardSlot[])
    normalizePackSlots(pack);

    const steps = pack.steps;

    //Nothing to do for null steps. Null represents default steps
    if (steps === null) {
      continue;
    }

    pack.steps = normalizeDraftSteps(steps);
  }

  return format;
};

export const normalizeDraftSteps = (steps: DraftStep[]): DraftStep[] => {
  const stepsLength = steps.length;
  if (stepsLength === 0) {
    return [];
  }

  const lastStep = steps[stepsLength - 1];
  if (lastStep?.action === 'pass') {
    steps.pop();
  }

  return steps;
};

export const getErrorsInFormat = (format: DraftFormat) => {
  const errors = [];
  if (!format?.packs) return ['Internal error in the format.'];
  if (!format.title.trim()) errors.push('title must not be empty.');
  if (format.packs.length === 0) errors.push('Format must have at least 1 pack.');

  if (format.defaultSeats !== undefined) {
    if (!Number.isFinite(format.defaultSeats)) errors.push('Default seat count must be a number.');
    if (format.defaultSeats < 2 || format.defaultSeats > 16)
      errors.push('Default seat count must be between 2 and 16.');
  }

  for (let i = 0; i < format.packs.length; i++) {
    const pack = format.packs[i];
    if (!pack) continue;

    let amount = 0;

    if (!pack.steps) {
      // this is ok, it just means the pack is a default pack
      continue;
    }

    const stepsLength = pack.steps.length;
    const lastStep = pack.steps[stepsLength - 1];
    if (lastStep?.action === 'pass') {
      errors.push(`Pack ${i + 1} cannot end with a pass action.`);
    }

    for (const step of pack.steps) {
      if (step === null) {
        continue;
      }

      const { action, amount: stepAmount } = step;

      if (action === 'pass') {
        continue;
      }

      if (stepAmount !== null) {
        amount += stepAmount;
      } else {
        amount += 1;
      }
    }

    const slotCount = pack.slots.length;
    if (amount !== slotCount) {
      errors.push(`Pack ${i + 1} has ${slotCount} slots but has steps to pick or trash ${amount} cards.`);
    }
  }
  return errors.length === 0 ? null : errors;
};

// Current version of the exported draft-format JSON envelope. Bump if the shape
// of an exported format ever changes in a breaking way.
export const DRAFT_FORMAT_EXPORT_VERSION = 1;

const DRAFT_ACTIONS: DraftAction[] = ['pick', 'pass', 'trash', 'pickrandom', 'trashrandom', 'endpack'];

// Folds a legacy top-level `board` field on a slot into the filter string as a
// `board=<name>` clause, mirroring the editor's on-load migration. New exports
// never carry the field, but hand-written or old JSON might.
const sanitizeImportedSlot = (raw: any): CardSlot => {
  const filter = typeof raw?.filter === 'string' ? raw.filter.trim() : '';
  const legacyBoard = typeof raw?.board === 'string' ? raw.board.trim() : '';
  if (legacyBoard && !/\bboard\s*[:=]/i.test(filter)) {
    return { filter: filter === '' || filter === '*' ? `board=${legacyBoard}` : `${filter} board=${legacyBoard}` };
  }
  return { filter };
};

const sanitizeImportedStep = (raw: any): DraftStep | null => {
  if (!raw || !DRAFT_ACTIONS.includes(raw.action)) return null;
  const amount = typeof raw.amount === 'number' && Number.isFinite(raw.amount) ? raw.amount : null;
  return { action: raw.action, amount };
};

const sanitizeImportedPack = (raw: any): Pack => {
  const slots = Array.isArray(raw?.slots) ? raw.slots.map(sanitizeImportedSlot) : [];
  const steps =
    raw?.steps === null || raw?.steps === undefined
      ? null
      : (raw.steps as any[]).map(sanitizeImportedStep).filter((s): s is DraftStep => s !== null);
  const pack: Pack = { slots, steps };
  if (raw?.randomizeOrder === true) pack.randomizeOrder = true;
  return pack;
};

/**
 * Produces a clean {@link DraftFormat} from arbitrary parsed JSON, keeping only
 * known fields and normalizing slots/steps. The derived `html` field is dropped
 * (it is regenerated from `markdown` on save). Throws if the input can't be
 * interpreted as a format at all.
 */
export const sanitizeImportedFormat = (raw: any): DraftFormat => {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.packs)) {
    throw new Error('Not a valid draft format.');
  }
  const format: DraftFormat = {
    title: typeof raw.title === 'string' ? raw.title : '',
    packs: raw.packs.map(sanitizeImportedPack),
    multiples: raw.multiples === true,
    defaultSeats: typeof raw.defaultSeats === 'number' && Number.isFinite(raw.defaultSeats) ? raw.defaultSeats : 8,
  };
  if (typeof raw.markdown === 'string') format.markdown = raw.markdown;
  if (typeof raw.basicsBoard === 'string') format.basicsBoard = raw.basicsBoard;
  return format;
};

/**
 * Parses a draft-format JSON export string. Accepts a bare format object, an
 * array of formats, or an envelope produced by {@link exportDraftFormat}
 * (`{ format }` or `{ formats }`). Returns the sanitized, validated formats or
 * an error message describing why the import failed.
 */
export const parseDraftFormatImport = (json: string): { formats: DraftFormat[]; error: string | null } => {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { formats: [], error: 'File is not valid JSON.' };
  }

  let candidates: any[];
  if (Array.isArray(parsed)) candidates = parsed;
  else if (Array.isArray(parsed?.formats)) candidates = parsed.formats;
  else if (parsed?.format) candidates = [parsed.format];
  else candidates = [parsed];

  if (candidates.length === 0) {
    return { formats: [], error: 'No draft formats found in the file.' };
  }

  const formats: DraftFormat[] = [];
  for (let i = 0; i < candidates.length; i++) {
    let format: DraftFormat;
    try {
      format = sanitizeImportedFormat(candidates[i]);
    } catch (e) {
      return { formats: [], error: `Format ${i + 1}: ${e instanceof Error ? e.message : 'invalid format'}` };
    }
    const errors = getErrorsInFormat(format);
    if (errors && errors.length > 0) {
      const label = format.title ? `"${format.title}"` : `${i + 1}`;
      return { formats: [], error: `Format ${label}: ${errors.join(', ')}` };
    }
    formats.push(format);
  }

  return { formats, error: null };
};

/**
 * Serializes a draft format to a pretty-printed JSON export string wrapped in a
 * versioned envelope. The derived `html` field is stripped so the export stays
 * portable and hand-editable.
 */
export const exportDraftFormat = (format: DraftFormat): string => {
  const { html: _html, ...rest } = format;
  return JSON.stringify({ version: DRAFT_FORMAT_EXPORT_VERSION, format: rest }, null, 2);
};

export const DEFAULT_STEPS: DraftStep[] = [
  { action: 'pick', amount: 1 },
  { action: 'pass', amount: null },
];

export const DEFAULT_PACK: Pack = Object.freeze({ slots: [{ filter: '' }], steps: DEFAULT_STEPS });

export const buildDefaultSteps: (cards: number) => DraftStep[] = (cards) => {
  const steps: DraftStep[] = new Array(cards).fill(DEFAULT_STEPS).flat();
  // the length should be cards*2-1, because the last pass is removed
  return normalizeDraftSteps(steps);
};

export const createDefaultDraftFormat = (packsPerPlayer: number, cardsPerPack: number): DraftFormat => {
  return {
    title: `Standard Draft`,
    packs: Array.from({ length: packsPerPlayer }, () => ({
      slots: Array.from({ length: cardsPerPack }, (): CardSlot => ({ filter: '*' })),
      steps: buildDefaultSteps(cardsPerPack),
    })),
    multiples: false,
    markdown: '',
    defaultSeats: 8,
  };
};

export const getInitialState = (draft: Draft): State => {
  const stepQueue: DraftStep[] = [];

  if (draft.InitialState) {
    // only look at the first seat
    const seat = draft.InitialState[0];

    if (seat) {
      for (const pack of seat) {
        const stepsLength = pack.steps.length;
        if (stepsLength === 0) {
          continue;
        }

        stepQueue.push(...pack.steps);

        //Backwards compatability, add endpack step to the end of the pack if the backend hasn't already
        if (pack.steps[stepsLength - 1]?.action !== 'endpack') {
          stepQueue.push({ action: 'endpack', amount: null });
        }
      }
    }
  }

  // if there are no picks made, return the initial state
  return {
    seats: draft.seats.map((_, index) => ({
      picks: [],
      trashed: [],
      pack:
        draft.InitialState && draft.InitialState[index] && draft.InitialState[index][0]
          ? draft.InitialState[index][0].cards
          : [],
    })),
    stepQueue,
    pack: 1,
    pick: 1,
  };
};
