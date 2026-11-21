/**
 * A deck's colors = the colors its non-land cards need, keeping any color that makes up more
 * than 10% of the non-land count (else colorless). Shared by the server (DraftDynamoDao), the
 * record and playtest analytics, the draft simulator and the bot-deckbuild lambda so the
 * heuristic stays in one place. Returns e.g. ['W','U'] or ['C'].
 *
 * A card with a parsed mana cost counts toward the colors it takes to cast, so mana rocks and
 * off-color activated abilities don't add a color. A hybrid, {2/W} or Phyrexian pip counts only
 * toward the colors the deck's plain pips already give it, when it can be paid with one of them,
 * and toward all of its colors when it can't. A card without a parsed cost counts toward its
 * color identity.
 */
export interface ColorAssessCard {
  isLand: boolean;
  colorIdentity: string[];
  // CardDetails.parsed_cost, e.g. ['1', 'g', 'g-w']
  parsedCost?: string[];
}

const COLORS = ['W', 'U', 'B', 'R', 'G'];
const SHARE = 0.1;

// A card's plain-pip colors, and the colors each hybrid, {2/W} or Phyrexian pip can be paid with.
// A pip that can be paid with a color the card already needs adds nothing, so it's dropped.
const costColors = (parsedCost: string[]): { required: Set<string>; open: string[][] } => {
  const required = new Set<string>();
  const open: string[][] = [];
  for (const symbol of parsedCost) {
    const parts = symbol.toUpperCase().split('-');
    const colors = parts.filter((part) => COLORS.includes(part));
    if (colors.length === 0) continue;
    if (parts.length === 1) required.add(colors[0]!);
    else open.push(colors);
  }
  return { required, open: open.filter((choice) => !choice.some((color) => required.has(color))) };
};

/**
 * The deck's colors (empty when colorless), and how many non-land cards count toward each color.
 */
export const deckColors = (cards: ColorAssessCard[]): { colors: string[]; counts: Record<string, number> } => {
  const spells = cards.filter((card) => !card.isLand);
  const costs = spells.map((card) =>
    card.parsedCost ? costColors(card.parsedCost) : { required: new Set(card.colorIdentity), open: [] },
  );
  const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const overShare = (color: string) => spells.length > 0 && (counts[color] ?? 0) / spells.length > SHARE;

  // The plain pips settle which colors the deck plays...
  for (const { required } of costs) {
    for (const color of required) if (counts[color] !== undefined) counts[color] += 1;
  }
  const played = new Set(COLORS.filter(overShare));

  // ...then each open pip goes to the deck's colors where it can, and to all of its own where it can't.
  for (const { open } of costs) {
    const extra = new Set<string>();
    for (const choice of open) {
      const inDeck = choice.filter((color) => played.has(color));
      for (const color of inDeck.length > 0 ? inDeck : choice) extra.add(color);
    }
    for (const color of extra) counts[color]! += 1;
  }

  return { colors: COLORS.filter(overShare), counts };
};

export const assessColors = (cards: ColorAssessCard[]): string[] => {
  const { colors } = deckColors(cards);
  return colors.length === 0 ? ['C'] : colors;
};
