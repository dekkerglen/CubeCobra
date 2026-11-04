import DraftSeat from '@utils/datatypes/DraftSeat';
import { PlayerList } from '@utils/datatypes/Record';
import { v4 as uuidv4 } from 'uuid';

/**
 * Gives every submitted player a stable `id`, inheriting the stored player's id
 * wherever the submission can plausibly still be "the same player" and minting
 * one only when it genuinely cannot.
 *
 * Minting for a player who already exists orphans `seat.playerId` and
 * misattributes their deck, so the match order favours certainty over
 * recency: an explicit submitted id is trusted outright, an exact name match
 * is tried next (a reorder keeps a player's id attached to their name), and
 * only then does position act as a fallback (a rename alone should not lose
 * identity). Each stored player can satisfy at most one submitted player —
 * once claimed, later submissions fall through to the next rule rather than
 * reusing an id that's already spoken for.
 */
export function reconcilePlayerIds(submitted: PlayerList, stored: PlayerList): PlayerList {
  const claimed = new Array(stored.length).fill(false);

  const claimById = (id: string): void => {
    const index = stored.findIndex((player, i) => !claimed[i] && player.id === id);
    if (index !== -1) {
      claimed[index] = true;
    }
  };

  const claimByName = (name: string): string | undefined => {
    const index = stored.findIndex((player, i) => !claimed[i] && player.name === name && player.id);
    if (index === -1) {
      return undefined;
    }
    claimed[index] = true;
    return stored[index]!.id;
  };

  const claimByPosition = (position: number): string | undefined => {
    if (position >= stored.length || claimed[position] || !stored[position]!.id) {
      return undefined;
    }
    claimed[position] = true;
    return stored[position]!.id;
  };

  return submitted.map((player, index) => {
    if (player.id) {
      claimById(player.id);
      return player;
    }
    const id = claimByName(player.name) ?? claimByPosition(index) ?? uuidv4();
    return { ...player, id };
  });
}

/**
 * Stamps each seat with the id of the player at its index, leaving seats with
 * no corresponding player (or whose player has no id) untouched. Purely
 * positional and purely additive — it is on the caller to never invoke this
 * for a played draft, whose seats must not be rewritten.
 */
export function stampSeatPlayerIds(seats: DraftSeat[], players: PlayerList): DraftSeat[] {
  return seats.map((seat, index) => {
    const playerId = players[index]?.id;
    return playerId ? { ...seat, playerId } : seat;
  });
}
