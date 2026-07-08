/**
 * A deck's colours = the color identities of its non-land cards, keeping any colour that
 * makes up more than 10% of the non-land count (else colourless). Shared by the server
 * (DraftDynamoDao.assessColors) and the bot-deckbuild lambda so the heuristic stays in one
 * place. Returns e.g. ['W','U'] or ['C'].
 */
export interface ColorAssessCard {
  isLand: boolean;
  colorIdentity: string[];
}

export const assessColors = (cards: ColorAssessCard[]): string[] => {
  const colors: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let count = 0;
  for (const card of cards) {
    if (card.isLand) continue;
    count += 1;
    for (const color of card.colorIdentity) {
      if (colors[color] !== undefined) colors[color] += 1;
    }
  }
  const filtered = Object.keys(colors).filter((color) => count > 0 && (colors[color] ?? 0) / count > 0.1);
  return filtered.length === 0 ? ['C'] : filtered;
};
