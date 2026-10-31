/**
 * Helpers for the line-oriented text exports (Card Names, Card Versions, Forge, XMage, MTGO).
 *
 * Unlike CSV, none of these formats have a quoting mechanism: every record is one line, and fields
 * are separated by literal characters. Card names and cube names are user-controlled - custom cards
 * and vouchers carry a free-text `custom_name`, and cube titles are only profanity-checked - so
 * anything written verbatim can forge extra entries in the downloaded file.
 *
 * The per-format line builders live here so the cube exports and the deck exports render a card
 * the same way.
 */
import { cardCollectorNumber, cardName, cardSet } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';

// Anything that ends a line, plus the tab some parsers treat as a separator.
const LINE_BREAKING = /[\r\n\t\v\f\u0085\u2028\u2029]+/g;

/**
 * Flattens a user-controlled value to something safe to write as part of a single export line.
 * A card named `Bolt\nSol Ring` would otherwise download as two separate card entries.
 */
export const exportTextValue = (value: string | null | undefined): string =>
  (value ?? '').replace(LINE_BREAKING, ' ').trim();

/**
 * Forge's `.dck` lines are `1 Name|SET`, with no way to escape a literal `|` in the name. Only
 * custom cards can contain one, and Forge would read everything after it as the set code, so it is
 * folded to `/` the same way split-card names are elsewhere.
 */
export const forgeName = (value: string | null | undefined): string => exportTextValue(value).replace(/\|/g, '/');

/**
 * Builds the `attachment; filename=` stem for an export. `\W` strips every non-ASCII letter, so a
 * cube titled only in non-Latin script would otherwise produce a bare `.txt` with no name at all.
 */
export const exportFileName = (name: string | null | undefined, fallback = 'cube'): string =>
  (name ?? '').replace(/\W/g, '') || fallback;

/**
 * A card's display name, flattened for a single export line. Goes through cardName, so a custom
 * card or voucher contributes the name its owner gave it rather than the catalog placeholder.
 */
export const exportCardName = (card: Card): string => exportTextValue(cardName(card));

/**
 * `Name (SET) 123` - the Card Versions export and Arena's deck format. Custom cards have no
 * printing, so each part is appended only when it exists rather than emitting empty brackets.
 */
export const setAndNumberLine = (card: Card): string => {
  const set = cardSet(card).toUpperCase();
  const collectorNumber = cardCollectorNumber(card);

  let line = exportCardName(card);
  if (set) {
    line += ` (${set})`;
    if (collectorNumber) {
      line += ` ${collectorNumber}`;
    }
  }
  return line;
};

/** `[SET:123] Name` - XMage. `[:] Name` fails to import, so an unprinted card gets a bare name. */
export const xmageLine = (card: Card): string => {
  const set = cardSet(card).toUpperCase();
  const collectorNumber = cardCollectorNumber(card);
  const version = set && collectorNumber ? `[${set}:${collectorNumber}] ` : '';

  return `${version}${exportCardName(card)}`;
};

/** `Name|SET` - Forge. A dangling `|` would be read as an empty set code, so it is dropped. */
export const forgeLine = (card: Card): string => {
  const set = cardSet(card).toUpperCase();

  return `${forgeName(cardName(card))}${set ? `|${set}` : ''}`;
};

/** MTGO writes split cards with a single slash rather than the ` // ` used everywhere else. */
export const mtgoName = (card: Card): string => exportCardName(card).replace(' // ', '/');
