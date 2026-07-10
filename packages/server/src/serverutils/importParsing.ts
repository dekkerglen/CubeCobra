// Pure parsing helpers for non-CSV (plain text) bulk imports.
//
// Kept dependency-free (and in its own module) so it can be unit tested in isolation and reused
// without pulling in the rest of the cube/server utilities.

export interface ParsedNonCSVLine {
  count: number;
  name: string;
  set?: string;
  collectorNumber?: string;
}

// Parses a single line of a non-CSV (plain text) bulk import into its parts. This supports the
// common "quantity name set number" shapes emitted by collection tools such as Delver Lens and
// ManaPools, with the edition/collector number optional:
//
//   4 Plains [M20] 261     -> { count: 4, name: 'Plains', set: 'M20', collectorNumber: '261' }
//   4 Plains [M20]         -> { count: 4, name: 'Plains', set: 'M20' }
//   4 Plains (M20)         -> { count: 4, name: 'Plains', set: 'M20' }
//   4 Plains               -> { count: 4, name: 'Plains' }
//   4x Plains              -> { count: 4, name: 'Plains' }
//   Plains                 -> { count: 1, name: 'Plains' }
//
// The set specifier is only recognised when it is a whitespace-free token wrapped in [] or ().
// Real card names never contain square brackets and set codes never contain whitespace, so a
// bracketed/parenthesised multi-word suffix (e.g. "B.F.M. (Big Furry Monster)") is left as part of
// the name rather than being mistaken for an edition.
export const parseNonCSVLine = (rawLine: string): ParsedNonCSVLine | null => {
  const line = rawLine.trim();
  if (!line) {
    return null;
  }

  //                    | count?     |  name  |            [set] / (set)             |  c.num?  |
  const match = line.match(/^(?:(\d+)[xX]?\s+)?(.+?)(?:\s+(?:\[([^\s[\]]+)\]|\(([^\s()]+)\))(?:\s+(\S+))?)?$/);
  if (!match) {
    return null;
  }

  const name = (match[2] || '').trim();
  if (!name) {
    return null;
  }

  let count = parseInt(match[1] || '1', 10);
  if (!Number.isInteger(count) || count < 1) {
    count = 1;
  }

  return {
    count,
    name,
    // Bracket form and paren form are mutually exclusive; whichever matched is the edition.
    set: match[3] || match[4] || undefined,
    collectorNumber: match[5] || undefined,
  };
};
