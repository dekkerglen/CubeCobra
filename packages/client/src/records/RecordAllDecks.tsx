import React, { useMemo } from 'react';

import Draft from '@utils/datatypes/Draft';
import Record, { formatRecord, playerRecord } from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';

import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { deckPiles, DeckStacksStatic } from 'components/DeckCard';

interface RecordAllDecksProps {
  record: Record;
  draft: Draft;
  players: User[];
  // Jump back to the single-deck view focused on one player.
  onSelectPlayer: (playerIndex: number) => void;
  canEdit: boolean;
}

// Every deck in the record laid out one after another, so the whole pod can be read
// (and compared) in one scroll instead of a player at a time. Each deck uses the same
// mana-value card stacks as the single-deck view. Mainboards only — sideboards and pick
// breakdowns stay there, which is what makes this dense enough to be worth having.
const RecordAllDecks: React.FC<RecordAllDecksProps> = ({ record, draft, players, onSelectPlayer, canEdit }) => {
  const decks = useMemo(
    () =>
      record.players
        .map((player, index) => {
          const seat = draft.seats[index];
          const piles = deckPiles(seat?.mainboard);
          const cardCount = piles.flat(3).filter((cardIndex) => draft.cards[cardIndex]).length;
          return { player, index, seat, piles, cardCount };
        })
        .filter((deck) => deck.cardCount > 0),
    [record.players, draft],
  );

  const withoutDecks = record.players.filter((_, index) => !decks.some((deck) => deck.index === index));

  // Avatar for a player linked to a CubeCobra account, matching the player pills.
  const linkedUser = (userId?: string) => (userId ? players.find((user) => user.id === userId) : undefined);

  if (decks.length === 0) {
    return (
      <Flexbox direction="col" gap="2">
        <Text sm className="text-text-secondary">
          No decks have been uploaded to this record yet.
        </Text>
        {canEdit && <Link href={`/cube/records/uploaddeck/${record.id}`}>Upload a deck to this record</Link>}
      </Flexbox>
    );
  }

  return (
    <Flexbox direction="col" gap="4">
      {decks.map(({ player, index, seat, piles, cardCount }) => (
        <Flexbox key={index} direction="col" gap="2" className="border border-border rounded-md p-3">
          <Flexbox direction="row" gap="3" wrap="wrap" alignItems="center">
            {linkedUser(player.userId)?.image?.uri ? (
              <img
                src={linkedUser(player.userId)!.image!.uri}
                alt=""
                className="w-7 h-7 rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="w-7 h-7 rounded-full bg-bg-active border border-border shrink-0" />
            )}
            <Text lg semibold>
              {record.trophy?.includes(player.name) ? '🏆 ' : ''}
              {player.name}
            </Text>
            {/* The generated archetype name ("WU Flyers"), when the seat has one. */}
            {seat?.name && (
              <Text sm className="text-text-secondary">
                {seat.name}
              </Text>
            )}
            <Text sm className="text-text-secondary">
              {formatRecord(playerRecord(record, player.name))}
            </Text>
            <Text sm className="text-text-secondary">
              {cardCount} cards
            </Text>
            <Link onClick={() => onSelectPlayer(index)}>View deck</Link>
            {canEdit && <Link href={`/draft/deckbuilder/${draft.id}?seat=${index}`}>Edit</Link>}
          </Flexbox>
          {/* p-0: the section around it already supplies the padding. */}
          <DeckStacksStatic piles={piles} cards={draft.cards} className="p-0" />
        </Flexbox>
      ))}
      {withoutDecks.length > 0 && (
        <Text sm className="text-text-secondary">
          No deck yet: {withoutDecks.map((player) => player.name).join(', ')}
        </Text>
      )}
    </Flexbox>
  );
};

export default RecordAllDecks;
