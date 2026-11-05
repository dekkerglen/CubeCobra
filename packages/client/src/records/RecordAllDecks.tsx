import React, { useMemo } from 'react';

import Draft from '@utils/datatypes/Draft';
import Record, { formatRecord, PlayerList, playerRecord } from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';

import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { deckPiles, DeckStacksStatic } from 'components/DeckCard';

interface RecordAllDecksProps {
  record: Record;
  draft: Draft;
  players: User[];
  // Jump to the Players tab, focused on this player's single-deck view. Crosses tabs rather
  // than switching a local sub-view, since Players and Decks are separate tabs now.
  onSelectPlayer: (playerIndex: number) => void;
  canEdit: boolean;
}

// The card chrome every entry on this tab wears, whether or not a deck has been uploaded.
const CARD_CLASS = 'border border-border rounded-md p-3';

interface PlayerHeadingProps {
  record: Record;
  player: PlayerList[number];
  user?: User;
  children?: React.ReactNode;
}

// Name and record, with the trophy and avatar that go with them. Shared so that a player who
// has yet to upload a deck reads as the same kind of entry as one who has, rather than as a
// footnote under the decks — everything deck-specific is passed in as children.
const PlayerHeading: React.FC<PlayerHeadingProps> = ({ record, player, user, children }) => (
  <Flexbox direction="row" gap="3" wrap="wrap" alignItems="center">
    {user?.image?.uri ? (
      <img src={user.image.uri} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
    ) : (
      <span className="w-7 h-7 rounded-full bg-bg-active border border-border shrink-0" />
    )}
    <Text lg semibold>
      {record.trophy?.includes(player.name) ? '🏆 ' : ''}
      {player.name}
    </Text>
    <Text sm className="text-text-secondary">
      {formatRecord(playerRecord(record, player.name))}
    </Text>
    {children}
  </Flexbox>
);

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

  const withoutDecks = record.players
    .map((player, index) => ({ player, index }))
    .filter(({ index }) => !decks.some((deck) => deck.index === index));

  // Avatar for a player linked to a CubeCobra account, matching the player pills.
  const linkedUser = (userId?: string) => (userId ? players.find((user) => user.id === userId) : undefined);

  // Nobody to list at all. With players present this tab always has something to show, even
  // before a single deck is collected — each player gets their own entry below.
  if (record.players.length === 0) {
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
        <Flexbox key={index} direction="col" gap="2" className={CARD_CLASS}>
          <PlayerHeading record={record} player={player} user={linkedUser(player.userId)}>
            {/* The generated archetype name ("WU Flyers"), when the seat has one. */}
            {seat?.name && (
              <Text sm className="text-text-secondary">
                {seat.name}
              </Text>
            )}
            <Text sm className="text-text-secondary">
              {cardCount} cards
            </Text>
            <Link onClick={() => onSelectPlayer(index)}>View deck</Link>
            {canEdit && <Link href={`/draft/deckbuilder/${draft.id}?seat=${index}`}>Edit</Link>}
          </PlayerHeading>
          {/* p-0: the section around it already supplies the padding. */}
          <DeckStacksStatic piles={piles} cards={draft.cards} className="p-0" />
        </Flexbox>
      ))}
      {withoutDecks.map(({ player, index }) => (
        <Flexbox key={index} direction="col" gap="2" className={CARD_CLASS}>
          <PlayerHeading record={record} player={player} user={linkedUser(player.userId)}>
            <Text sm className="text-text-secondary">
              No deck yet
            </Text>
            {/* `?player=` is 1-based — 0 means "no player selected" — so the upload form opens
                with this player already chosen instead of making the owner pick them again. */}
            {canEdit && (
              <Link href={`/cube/records/uploaddeck/${record.id}?player=${index + 1}`}>
                {`Upload a deck for ${player.name}`}
              </Link>
            )}
          </PlayerHeading>
        </Flexbox>
      ))}
    </Flexbox>
  );
};

export default RecordAllDecks;
