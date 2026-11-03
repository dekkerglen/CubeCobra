import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import Record, { formatRecord, PlayerList, playerRecord } from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';

import { UncontrolledAlertProps } from 'components/base/Alert';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';

import UploadDeck from '../UploadDeck';
import UploadDeckFromPhoto from '../UploadDeckFromPhoto';
import { DeckBoard, TranscribeDeck, TranscribePaste } from './transcribeState';

type Player = PlayerList[number];

interface TranscribePlayersProps {
  cube: Cube;
  // The live state as a record, so standings and trophies read the same helpers the record
  // page does rather than a second implementation.
  record: Record;
  draft?: Draft;
  linkedUsers: User[];
  decks: { [playerIndex: number]: TranscribeDeck };
  setDeckBoard: (playerIndex: number, board: DeckBoard, update: React.SetStateAction<CardDetails[]>) => void;
  setTrophy: (trophy: string[]) => void;
  // False when the record is backed by a played draft: the draft's seats are positionally
  // tied to the player list, so adding, removing and shuffling are not offered at all.
  // Renaming still is — it is the one player edit such a record accepts.
  seatsEditable: boolean;
  // True while a save is in flight. Every player edit is held shut for the length of the
  // request: the page re-bases seatOrder to identity when the save lands, which is only
  // sound if no new permutation can have been created against the seats the server has
  // just moved.
  editsDisabled: boolean;
  // The edited list, plus the seat each entry came from in the list as it stands (-1 for a
  // player being added). The page re-keys everything from that mapping. Answers false when
  // the edit was refused — the page turns every player edit away for the length of a save —
  // so a caller that awaited a lookup does not report an edit that never landed.
  onApplyPlayers: (players: PlayerList, originSeats: number[]) => boolean;
  // A half-finished paste per player. It is held by the page rather than by the deck editor
  // because that editor is unmounted the moment another player's row is opened, and rather
  // than by this component because it has to follow its player through a reorder.
  pastes: { [playerIndex: number]: TranscribePaste };
  setPasteText: (playerIndex: number, text: string) => void;
  setPasteErrors: (playerIndex: number, errors: string[]) => void;
  setAlerts: React.Dispatch<React.SetStateAction<UncontrolledAlertProps[]>>;
}

// A leading @ links the player to a CubeCobra account, matching EditPlayerList.
const useResolvePlayer = () => {
  const { csrfFetch } = useContext(CSRFContext);

  return useCallback(
    async (raw: string): Promise<Player | null> => {
      const trimmed = raw.trim();
      const isHandle = trimmed.startsWith('@');
      const lookupName = isHandle ? trimmed.slice(1).trim() : trimmed;
      if (!lookupName) {
        return null;
      }
      if (!isHandle) {
        return { name: lookupName };
      }
      try {
        const response = await csrfFetch(`/api/user/getByUsername/${encodeURIComponent(lookupName)}`, {
          method: 'GET',
        });
        const { user } = await response.json();
        return { name: user?.username || lookupName, userId: user?.id || undefined };
      } catch {
        return { name: lookupName };
      }
    },
    [csrfFetch],
  );
};

const summarize = (deck: TranscribeDeck | undefined): string => {
  if (!deck || deck.mainboard.length === 0) {
    return 'No deck yet';
  }
  const sideboard = deck.sideboard.length > 0 ? ` + ${deck.sideboard.length} sideboard` : '';
  return `${deck.mainboard.length} cards${sideboard}`;
};

// What the name field shows for a player, and what a committed rename has to come back as
// before the field stops offering to re-send it.
const displayName = (player: Player): string => (player.userId ? `@${player.name}` : player.name);

const CardNameList: React.FC<{ title: string; cards: CardDetails[] }> = ({ title, cards }) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <Flexbox direction="col" gap="1">
      <Text sm semibold>
        {`${title} (${cards.length})`}
      </Text>
      <ul className="mb-0">
        {cards.map((card, index) => (
          <li key={index}>
            <Text sm>{card.name}</Text>
          </li>
        ))}
      </ul>
    </Flexbox>
  );
};

interface PlayerNameFieldProps {
  id: string;
  player: Player;
  // True when this player's committed name collides with another's. Derived from the state
  // the rename landed in rather than from the attempt, so a collision that arrived some
  // other way — a seeded record, the player renamed out from under this one — reads the same.
  duplicate: boolean;
  // Resolves the typed value and applies it, answering with the player as it landed, or null
  // when the entry was empty, or undefined when a save in flight refused the edit.
  onRename: (raw: string) => Promise<Player | null | undefined>;
}

// Commits on blur and on Enter: with the player's whole body on screen there is nothing for
// a dedicated save button to disambiguate, and it wrapped.
const PlayerNameField: React.FC<PlayerNameFieldProps> = ({ id, player, duplicate, onRename }) => {
  const [value, setValue] = useState<string>(() => displayName(player));
  const [empty, setEmpty] = useState<boolean>(false);

  const commit = async () => {
    if (value.trim() === displayName(player).trim()) {
      return;
    }
    const landed = await onRename(value);
    if (landed) {
      // The account's own spelling, which is what the row now shows.
      setValue(displayName(landed));
    }
    setEmpty(landed === null);
  };

  const error = empty ? 'Enter a name' : duplicate ? `Another player is already named ${player.name}` : '';

  return (
    <Flexbox direction="col" gap="1">
      <Input
        id={id}
        label="Player name"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setEmpty(false);
        }}
        onEnter={commit}
        otherInputProps={{ onBlur: commit }}
        placeholder="Prefix with @ to link a CubeCobra account"
        valid={error ? false : undefined}
      />
      {error && (
        <Text sm className="text-danger">
          {error}
        </Text>
      )}
    </Flexbox>
  );
};

// One collapsible row per player: the summary line is who they are, the body is everything
// about them. Only one body is mounted at a time — the deck editor loads the cube's basics
// on mount, and a pod of eight would do that eight times over.
const TranscribePlayers: React.FC<TranscribePlayersProps> = ({
  cube,
  record,
  draft,
  linkedUsers,
  decks,
  setDeckBoard,
  setTrophy,
  seatsEditable,
  editsDisabled,
  onApplyPlayers,
  pastes,
  setPasteText,
  setPasteErrors,
  setAlerts,
}) => {
  const resolvePlayer = useResolvePlayer();
  const players = record.players;

  // Open on the first player still missing a deck — the next one to transcribe.
  const [expanded, setExpanded] = useState<number>(() => {
    const firstDeckless = players.findIndex((_, index) => (decks[index]?.mainboard.length ?? 0) === 0);
    return firstDeckless === -1 ? 0 : firstDeckless;
  });
  const [newPlayer, setNewPlayer] = useState<string>('');

  // The add and rename commits await an @handle lookup before they apply, so by the time they
  // do, the list their render closed over may be several edits out of date — the player being
  // renamed may have been removed in the meantime. They resolve against this instead, so an
  // edit that landed during the lookup is respected rather than overwritten by a snapshot.
  const playersRef = useRef<PlayerList>(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const identitySeats = useCallback(() => players.map((_, index) => index), [players]);

  // The fieldsets below make these unreachable in a browser, and the page refuses a mid-save
  // apply at the chokepoint besides, but the invariant the page's seatOrder re-base depends on
  // is too load-bearing to rest on either alone: every path that can reach onApplyPlayers
  // refuses for itself while a save is open.
  const addPlayer = useCallback(async () => {
    if (editsDisabled || !seatsEditable) {
      return;
    }
    const resolved = await resolvePlayer(newPlayer);
    if (!resolved) {
      return;
    }
    // Against the list as it stands now, not as it stood when the lookup was started.
    const current = playersRef.current;
    if (!onApplyPlayers([...current, resolved], [...current.map((_, seat) => seat), -1])) {
      // Refused — a save opened during the lookup. Leave what was typed where it is.
      return;
    }
    setNewPlayer('');
  }, [editsDisabled, seatsEditable, resolvePlayer, newPlayer, onApplyPlayers]);

  const removePlayer = useCallback(
    (index: number) => {
      if (editsDisabled || !seatsEditable) {
        return;
      }
      onApplyPlayers(
        players.filter((_, seat) => seat !== index),
        identitySeats().filter((seat) => seat !== index),
      );
      // The body holding the control that was just clicked belongs to a player who is gone,
      // and every row below has moved up a seat.
      setExpanded(-1);
    },
    [editsDisabled, seatsEditable, onApplyPlayers, players, identitySeats],
  );

  const shufflePlayers = useCallback(() => {
    if (editsDisabled || !seatsEditable) {
      return;
    }
    const order = identitySeats().sort(() => Math.random() - 0.5);
    onApplyPlayers(
      order.map((seat) => players[seat]),
      order,
    );
    // An open body is keyed by seat, so leaving it open would hand one player's half-typed
    // name field to whoever landed in their seat.
    setExpanded(-1);
  }, [editsDisabled, seatsEditable, onApplyPlayers, players, identitySeats]);

  const renamePlayer = useCallback(
    async (index: number, raw: string): Promise<Player | null | undefined> => {
      if (editsDisabled) {
        return undefined;
      }
      // Who this commit is about, pinned by identity before the lookup, because the seat it
      // was typed in is not stable across one.
      const target = playersRef.current[index];
      if (!target) {
        return undefined;
      }
      const resolved = await resolvePlayer(raw);
      if (!resolved) {
        return null;
      }
      const current = playersRef.current;
      // The player was removed, or renamed some other way, while the lookup was outstanding.
      // Applying the snapshot this commit started from would resurrect them.
      const seat = current.indexOf(target);
      if (seat === -1) {
        return undefined;
      }
      // A collision is applied rather than refused, so the typing is not thrown away.
      // validationErrors reports it page-wide and holds Save back, so it cannot be saved.
      const applied = onApplyPlayers(
        current.map((player, other) => (other === seat ? resolved : player)),
        current.map((_, other) => other),
      );
      // Refused by the page because a save opened during the lookup. Reporting the resolved
      // player would have the field rewrite itself to a name the record does not hold.
      return applied ? resolved : undefined;
    },
    [editsDisabled, resolvePlayer, onApplyPlayers],
  );

  const toggleTrophy = useCallback(
    (name: string, held: boolean) => {
      if (editsDisabled) {
        return;
      }
      const trophies = record.trophy ?? [];
      setTrophy(held ? [...trophies, name] : trophies.filter((trophy) => trophy !== name));
    },
    [editsDisabled, record.trophy, setTrophy],
  );

  const setters = useMemo(
    () =>
      players.map((_, index) => ({
        setMainboard: ((update: React.SetStateAction<CardDetails[]>) =>
          setDeckBoard(index, 'mainboard', update)) as React.Dispatch<React.SetStateAction<CardDetails[]>>,
        setSideboard: ((update: React.SetStateAction<CardDetails[]>) =>
          setDeckBoard(index, 'sideboard', update)) as React.Dispatch<React.SetStateAction<CardDetails[]>>,
        setDecklistText: (text: string) => setPasteText(index, text),
        setParseErrors: (errors: string[]) => setPasteErrors(index, errors),
      })),
    [players, setDeckBoard, setPasteText, setPasteErrors],
  );

  return (
    <Flexbox direction="col" gap="2">
      <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap">
        <Text sm className="text-text-secondary">
          {`${players.length} ${players.length === 1 ? 'player' : 'players'}`}
        </Text>
        {seatsEditable && (
          <fieldset disabled={editsDisabled} className="min-w-0 border-0 p-0 m-0">
            <Flexbox direction="row" gap="2" alignItems="center" wrap="wrap">
              <Input
                value={newPlayer}
                onChange={(event) => setNewPlayer(event.target.value)}
                onEnter={addPlayer}
                placeholder="Add a player (@ to link an account)"
                wrapperClassName="w-64"
              />
              <Button color="primary" onClick={addPlayer}>
                <span className="text-nowrap">Add Player</span>
              </Button>
              <Button color="accent" onClick={shufflePlayers}>
                <span className="text-nowrap">Shuffle Players</span>
              </Button>
            </Flexbox>
          </fieldset>
        )}
      </Flexbox>

      {!seatsEditable && (
        <Text sm className="text-text-secondary">
          This record is attached to a played draft, so its players line up with the draft&apos;s seats and cannot be
          added, removed or reordered here. Renaming one is still fine.
        </Text>
      )}

      {players.map((player, index) => {
        const deck = decks[index];
        const open = expanded === index;
        const linked = linkedUsers.find((user) => user.id === player.userId);
        const held = (record.trophy ?? []).includes(player.name);
        const duplicate = players.some(
          (other, seat) => seat !== index && other.name.toLowerCase() === player.name.toLowerCase(),
        );

        return (
          <div key={index} data-testid="transcribe-player-row">
            <Card>
              <CardHeader>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpanded(open ? -1 : index)}
                  aria-expanded={open}
                >
                  <Flexbox direction="row" justify="between" alignItems="center" gap="2">
                    <Flexbox direction="row" alignItems="center" gap="2" className="min-w-0">
                      {linked?.image?.uri ? (
                        <img src={linked.image.uri} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-bg-active border border-border shrink-0" />
                      )}
                      {held && (
                        <span role="img" aria-label="Trophy" className="shrink-0">
                          🏆
                        </span>
                      )}
                      <Text semibold className="truncate">
                        {player.name}
                      </Text>
                    </Flexbox>
                    <Text sm className="text-text-secondary shrink-0">
                      {`${formatRecord(playerRecord(record, player.name))} • ${summarize(deck)}${
                        deck?.dirty ? ' • unsaved' : ''
                      }`}
                    </Text>
                  </Flexbox>
                </button>
              </CardHeader>
              {open && (
                <CardBody>
                  <Flexbox direction="col" gap="3">
                    {/* A save rewrites the draft's seats into the submitted player order, and
                        the page re-bases seatOrder to identity once it lands. Holding every
                        player edit shut for the length of the request is what makes that
                        re-base unambiguous: a rename, add, remove or shuffle applied
                        mid-flight would be expressed against seats the server has already
                        moved, and the next save would misattribute every deck. */}
                    <fieldset disabled={editsDisabled} className="min-w-0 border-0 p-0 m-0">
                      <Flexbox direction="col" gap="2">
                        <PlayerNameField
                          id={`transcribe-player-name-${index}`}
                          player={player}
                          duplicate={duplicate}
                          onRename={(raw) => renamePlayer(index, raw)}
                        />
                        <Flexbox direction="row" gap="3" alignItems="center" wrap="wrap">
                          <Checkbox
                            label="Trophy"
                            checked={held}
                            setChecked={(checked) => toggleTrophy(player.name, checked)}
                          />
                          {seatsEditable && (
                            <Button
                              color="danger"
                              aria-label={`Remove ${player.name}`}
                              onClick={() => removePlayer(index)}
                            >
                              <span className="text-nowrap">Remove player</span>
                            </Button>
                          )}
                        </Flexbox>
                      </Flexbox>
                    </fieldset>

                    {!deck || deck.editable ? (
                      <Flexbox direction="col" gap="2">
                        <UploadDeckFromPhoto
                          cube={cube}
                          setMainboardCards={setters[index].setMainboard}
                          setSideboardCards={setters[index].setSideboard}
                          setAlerts={setAlerts}
                        />
                        <UploadDeck
                          // This row is already bound to one player, so UploadDeck's picker
                          // has nothing to choose: it is handed a one-player record and a
                          // setter that does nothing, which leaves it showing whose deck is
                          // being entered.
                          selectedUser={1}
                          setSelectedUser={() => {}}
                          record={{ ...record, players: [player] }}
                          mainboardCards={deck?.mainboard ?? []}
                          setMainboardCards={setters[index].setMainboard}
                          sideboardCards={deck?.sideboard ?? []}
                          setSideboardCards={setters[index].setSideboard}
                          setAlerts={setAlerts}
                          cubeId={cube.id}
                          // Held outside the editor, so collapsing this row to look at
                          // another player does not discard a paste mid-correction.
                          decklistText={pastes[index]?.text ?? ''}
                          setDecklistText={setters[index].setDecklistText}
                          parseErrors={pastes[index]?.errors ?? []}
                          setParseErrors={setters[index].setParseErrors}
                        />
                      </Flexbox>
                    ) : (
                      <Flexbox direction="col" gap="2">
                        <Text sm className="text-text-secondary">
                          This record is attached to a played draft, so this deck is tied to the seat that drafted it
                          and cannot be re-entered here.
                        </Text>
                        {draft && (
                          <Link href={`/draft/deckbuilder/${draft.id}?seat=${index}`}>
                            Edit this deck in the deckbuilder
                          </Link>
                        )}
                        <CardNameList title="Mainboard" cards={deck.mainboard} />
                        <CardNameList title="Sideboard" cards={deck.sideboard} />
                      </Flexbox>
                    )}
                  </Flexbox>
                </CardBody>
              )}
            </Card>
          </div>
        );
      })}
    </Flexbox>
  );
};

export default TranscribePlayers;
