// Parses a pasted decklist into per-board card entries.
//
// Builds on the plain-text line parsing used by the cube bulk importer, adding the section markers
// ("Sideboard", "Deck", ...) that decklist exports use to split a list into boards. Kept
// dependency-free so both the server and the client can use it.

import { parseNonCSVLine } from './importParsing';

export type DecklistBoard = 'mainboard' | 'sideboard';

export interface DecklistEntry {
  board: DecklistBoard;
  count: number;
  name: string;
  // The original line, so callers can report which paste line failed to resolve.
  line: string;
}

const SECTION_MARKERS = new Map<string, DecklistBoard>([
  ['deck', 'mainboard'],
  ['maindeck', 'mainboard'],
  ['main', 'mainboard'],
  ['mainboard', 'mainboard'],
  ['sideboard', 'sideboard'],
  ['sb', 'sideboard'],
]);

// Returns the board a section marker line switches to, or null if the line isn't a marker.
//
// The keyword must be the entire line once a leading "//", surrounding whitespace (including a
// trailing carriage return) and a trailing colon are stripped. Matching the whole line is what
// keeps a card line such as "1 Sideboard" from being mistaken for a section switch.
export const decklistSectionMarker = (line: string): DecklistBoard | null => {
  const keyword = line
    .trim()
    .replace(/^\/\/\s*/, '')
    .replace(/\s*:$/, '')
    .trim()
    .toLowerCase();

  return SECTION_MARKERS.get(keyword) ?? null;
};

// Parses a pasted decklist into one entry per card line, in source order. Lines beneath a section
// marker belong to that marker's board; everything before the first marker belongs to defaultBoard.
// Blank lines never switch boards, and lines that aren't parseable as cards are dropped.
//
// Any set code or collector number on a line is discarded: callers resolve names against their own
// card pool, so a pasted printing can't be honoured.
export const parseDecklist = (text: string, defaultBoard: DecklistBoard): DecklistEntry[] => {
  const entries: DecklistEntry[] = [];
  let board = defaultBoard;

  for (const line of text.split(/\r?\n/)) {
    const marker = decklistSectionMarker(line);
    if (marker) {
      board = marker;
      continue;
    }

    const parsed = parseNonCSVLine(line);
    if (!parsed) {
      continue;
    }

    entries.push({ board, count: parsed.count, name: parsed.name, line });
  }

  return entries;
};
