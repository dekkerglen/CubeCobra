import Record, { applyPlayerRenames, PlayerList, Round, WinLossDraw } from '@utils/datatypes/Record';

// The sections of a submission that stay keyed by player name in storage. `players` itself is
// never rebased here: that section is what a real rename-vs-rename conflict is detected
// against, and that detection is the endpoint's job, not this one's.
export interface NameKeyedSections {
  matches?: Round[];
  trophy?: string[];
  overrides?: { [playerName: string]: WinLossDraw };
}

// A submission's names and the stored list's names can diverge for a player who kept their
// identity (same id) but was renamed on either side — by the submitter re-keying their own
// edit, or by a contributor correcting their name on the share link since the submitter last
// loaded the record. Re-expressing the submission in the stored list's names before anything
// is compared means neither direction looks like it touched a section it didn't.
//
// Only ids both lists agree on produce a rename; a name with no id, or an id missing from one
// side, passes through untouched. That makes this a no-op on an all-legacy record (no player
// has an id yet) without any special-casing.
export function rebaseNameKeyedSections(
  submitted: NameKeyedSections,
  submittedPlayers: PlayerList,
  storedPlayers: PlayerList,
): NameKeyedSections {
  const storedNameById = new Map<string, string>();
  for (const player of storedPlayers) {
    if (player.id) {
      storedNameById.set(player.id, player.name);
    }
  }

  // Built from the whole submitted list and applied in one pass (via applyPlayerRenames) so a
  // straight swap of two players' names resolves against the originals instead of chaining
  // through itself.
  const renames = new Map<string, string>();
  for (const player of submittedPlayers) {
    if (!player.id) {
      continue;
    }
    const storedName = storedNameById.get(player.id);
    if (storedName && storedName !== player.name) {
      renames.set(player.name, storedName);
    }
  }

  if (renames.size === 0) {
    return submitted;
  }

  // applyPlayerRenames mutates a Record-shaped object; build a minimal stand-in from only the
  // sections present so an absent section stays absent rather than being materialised as empty.
  const scratch = {
    matches: submitted.matches ?? [],
    trophy: submitted.trophy ?? [],
    overrides: submitted.overrides,
  } as Record;
  applyPlayerRenames(scratch, renames);

  return {
    ...submitted,
    ...(submitted.matches !== undefined ? { matches: scratch.matches } : {}),
    ...(submitted.trophy !== undefined ? { trophy: scratch.trophy } : {}),
    ...(submitted.overrides !== undefined ? { overrides: scratch.overrides } : {}),
  };
}
