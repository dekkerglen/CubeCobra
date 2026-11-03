import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { arrayMove } from '@dnd-kit/sortable';
import { ChevronDownIcon, ChevronRightIcon, GrabberIcon, TrophyIcon } from '@primer/octicons-react';
import { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import Record, { formatRecord, PlayerList, playerRecord, WinLossDraw } from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';

import { UncontrolledAlertProps } from 'components/base/Alert';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { SortableItem, SortableList } from 'components/DND';
import { CSRFContext } from 'contexts/CSRFContext';

import UploadDeck from '../UploadDeck';
import UploadDeckFromPhoto from '../UploadDeckFromPhoto';
import { DeckBoard, TranscribeDeck, TranscribePaste } from './transcribeState';
import { ResultsMode } from './TranscribeRounds';

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
  // Which kind of record is being written down. In records mode every row's record is three
  // editable cells; in pairings mode a row reads its derived record until the cells are
  // asked for. Both modes write to the same overrides map.
  resultsMode: ResultsMode;
  // The manual per-player record, keyed by player name. A name maps to undefined once its
  // override has been cleared, which is why this is read from here rather than off `record`.
  overrides: { [playerName: string]: WinLossDraw | undefined };
  setOverride: (playerName: string, value: WinLossDraw | undefined) => void;
  // False when the record is backed by a played draft: the draft's seats are positionally
  // tied to the player list, so adding, removing, shuffling and dragging to reorder are not
  // offered at all. Renaming still is — it is the one player edit such a record accepts.
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

// Two numbers in a fixed column rather than a sentence, so sixteen rows of them read down
// as a table. What they count is said by the column heading and the tooltip, not by the cell.
const deckCounts = (deck: TranscribeDeck | undefined): { main: number; side: number } => ({
  main: deck?.mainboard.length ?? 0,
  side: deck?.sideboard.length ?? 0,
});

// What the name field shows for a player, and what a committed rename has to come back as
// before the field stops offering to re-send it.
const displayName = (player: Player): string => (player.userId ? `@${player.name}` : player.name);

// The name a typed entry is asking for, without the @ that only says where to look it up.
const bareName = (raw: string): string => raw.trim().replace(/^@/, '').trim();

// What a rename or an add answers with when the name it resolved to already belongs to
// another player. It is refused rather than applied: applyPlayerEdit rewrites everything
// keyed by player name — pairings, trophies and overrides — so a list holding the same name
// twice folds two players' results onto one key, and correcting the typo afterwards cannot
// bring back what the collision overwrote. Nothing is thrown away by refusing: the field
// keeps the typed text and says why it did not land.
const COLLISION = 'duplicate' as const;

// Whether `name` is already taken by a player other than the one at `exclude` (-1 when the
// name is being added rather than moved onto a seat). Case-insensitive, matching the
// page-level duplicate check in validationErrors.
const nameTaken = (players: PlayerList, name: string, exclude: number): boolean =>
  players.some((player, seat) => seat !== exclude && player.name.toLowerCase() === name.toLowerCase());

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
  // when the entry was empty, or 'duplicate' when it would have taken another player's name,
  // or undefined when a save in flight refused the edit.
  onRename: (raw: string) => Promise<Player | null | undefined | typeof COLLISION>;
  // The row's name field lives outside the body's fieldset, so it carries its own copy of
  // the hold a save in flight puts on every player edit.
  disabled: boolean;
}

// Commits on blur and on Enter: with the player's whole body on screen there is nothing for
// a dedicated save button to disambiguate, and it wrapped.
const PlayerNameField: React.FC<PlayerNameFieldProps> = ({ id, player, duplicate, onRename, disabled }) => {
  const committed = displayName(player);
  const [value, setValue] = useState<string>(committed);
  const [empty, setEmpty] = useState<boolean>(false);
  // The name a refused commit tried to take. Held here rather than derived from state
  // because the rename never landed: the record still holds this player under their old
  // name, and the only trace of the attempt is the text still in this field.
  const [collision, setCollision] = useState<string>('');
  // What the draft above was seeded from. The field is mounted for every row now, open or
  // shut, and the rows are keyed by seat rather than by player — so a reorder hands this
  // component a different player without remounting it, and an untracked draft would show
  // one player's name over another's row and rename them on the next blur.
  const [seed, setSeed] = useState<string>(committed);
  if (seed !== committed) {
    setSeed(committed);
    setValue(committed);
    setEmpty(false);
    setCollision('');
  }

  const commit = async () => {
    if (value.trim() === committed.trim()) {
      return;
    }
    const landed = await onRename(value);
    if (landed === COLLISION) {
      // Refused: the field keeps what was typed so it can be corrected in place, and says
      // why rather than silently reverting.
      setCollision(bareName(value));
      setEmpty(false);
      return;
    }
    setCollision('');
    if (landed) {
      // The account's own spelling, which is what the row now shows.
      setValue(displayName(landed));
    }
    setEmpty(landed === null);
  };

  // A refused collision is reported from the attempt; `duplicate` still covers one that
  // arrived some other way — a seeded record, or a list that already held two of a name.
  const error = empty
    ? 'Enter a name'
    : collision
      ? `Another player is already named ${collision}`
      : duplicate
        ? `Another player is already named ${player.name}`
        : '';

  return (
    <Flexbox direction="col" gap="1" className="min-w-0 grow">
      <Input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          setValue(event.target.value);
          setEmpty(false);
          setCollision('');
        }}
        onEnter={commit}
        otherInputProps={{ onBlur: commit, 'aria-label': 'Player name' }}
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

const RECORD_FIELDS: { label: string; key: keyof WinLossDraw }[] = [
  { label: 'Wins', key: 'wins' },
  { label: 'Losses', key: 'losses' },
  { label: 'Draws', key: 'draws' },
];

// A non-negative integer, which is the whole of what the endpoint accepts
// (`Joi.number().integer().min(0)`). The input's min=0 is advisory: a number input still
// reports a typed or pasted "-1" or "1.5" through onChange, and either answers with a raw
// 400 that rejects the entire transcription, not just the offending cell.
const toCount = (raw: string): number => Math.max(0, Math.floor(Number(raw) || 0));

// The width every column of the row and its headings is cut to.
const DECK_COLUMN = 'w-24';
const RECORD_COLUMN = 'w-20';

// The mainboard and sideboard counts, as a column rather than a sentence.
const DeckCounts: React.FC<{ deck: TranscribeDeck | undefined }> = ({ deck }) => {
  const { main, side } = deckCounts(deck);
  const unsaved = deck?.dirty ? ' — unsaved' : '';

  return (
    // A title rather than a hover card, matching the record cells beside it: two bare numbers
    // and an asterisk need naming, and the column heading only has room to name them once.
    <span
      data-testid="deck-counts"
      title={`${main} Mainboard / ${side} Sideboard${unsaved}`}
      className={`${DECK_COLUMN} shrink-0 text-center text-sm ${deck?.dirty ? 'text-text' : 'text-text-secondary'}`}
    >
      {`${main} / ${side}${deck?.dirty ? ' *' : ''}`}
    </span>
  );
};

interface OverrideControlsProps {
  player: Player;
  derived: WinLossDraw;
  override: WinLossDraw | undefined;
  // Whether the record carries any pairings at all. With none there is no second reading to
  // disclose, so a row carrying an override has nothing to show alongside it.
  hasPairings: boolean;
  clearOverride: () => void;
}

// What a row carrying an override shows beside it. Rendered left of every fixed column
// rather than among them, because it is the one thing on the row whose width varies.
const OverrideControls: React.FC<OverrideControlsProps> = ({
  player,
  derived,
  override,
  hasPairings,
  clearOverride,
}) => {
  if (!override) {
    return null;
  }

  return (
    <Flexbox direction="row" alignItems="center" gap="1" wrap="wrap">
      {hasPairings && (
        // The precedence disclosure: this player's pairings say one thing and the record
        // displays another, so both are on screen together.
        <Text sm className="text-text-secondary text-nowrap">
          {`From pairings: ${formatRecord(derived)}`}
        </Text>
      )}
      <Button color="secondary" aria-label={`Clear ${player.name}'s record`} onClick={clearOverride}>
        <span className="text-nowrap">Clear</span>
      </Button>
    </Flexbox>
  );
};

interface PlayerRecordProps {
  player: Player;
  // What this player's pairings add up to, ignoring any override — the reading the override
  // is displacing, and what the cells are seeded with.
  derived: WinLossDraw;
  override: WinLossDraw | undefined;
  // Records mode is nothing but cells; pairings mode derives every record from the matches
  // below, so its cells are read-only. They are rendered either way, so a row keeps the same
  // shape across both modes and the columns stay where the eye left them.
  editable: boolean;
  setOverride: (value: WinLossDraw | undefined) => void;
}

// A player's three record cells, and nothing else — every neighbour is fixed-width, so the
// three of them land at the same x on every row and the headings above the list stay true.
const PlayerRecord: React.FC<PlayerRecordProps> = ({ player, derived, override, editable, setOverride }) => {
  // What the record actually reads: playerRecord prefers any present override, so showing a
  // derived total while an override is stored would be a lie — including in pairings mode,
  // where Clear is then the only way to hand the player back to their matches.
  const seed = override ?? derived;

  return (
    <Flexbox direction="row" alignItems="center" gap="1">
      {RECORD_FIELDS.map(({ label, key }) => (
        <Input
          key={key}
          type="number"
          value={`${seed[key]}`}
          disabled={!editable}
          onChange={(event) => setOverride({ ...seed, [key]: toCount(event.target.value) })}
          // Named rather than labelled: a visible label on all three would break the one-line
          // `[W] [L] [D]` reading the row is for, and sixteen rows of them is unreadable. The
          // title is the per-cell cue that names the box without taking a line, alongside the
          // column headings above the list.
          otherInputProps={{ min: 0, title: label, 'aria-label': `${label} for ${player.name}` }}
          wrapperClassName={RECORD_COLUMN}
        />
      ))}
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
  resultsMode,
  overrides,
  setOverride,
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
  // Every row shut. Opening one on load guesses at what the page is for — a row's summary
  // line carries its name, deck counts and record, which is what most visits come to read.
  const [expanded, setExpanded] = useState<number>(-1);
  const [newPlayer, setNewPlayer] = useState<string>('');
  // Why the last add did not land, when it was refused for taking a name already in the
  // list. The entry stays in the field so it can be corrected rather than retyped.
  const [addError, setAddError] = useState<string>('');
  // A record can hold both pairings and overrides at once, and the override wins. The row
  // only has a second reading worth disclosing when there are pairings behind it.
  const hasPairings = useMemo(() => (record.matches ?? []).some((round) => round.matches.length > 0), [record.matches]);

  // playerRecord prefers any present override, so reading what a player's pairings alone say
  // means asking it against a record carrying none.
  const withoutOverrides = useMemo(() => ({ ...record, overrides: {} }), [record]);

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
    // The other way a name can be taken twice. A duplicate added here is not destructive on
    // its own, but it makes both seats share every name-keyed thing in the record, and the
    // rename that corrects it would then rewrite both. Refused the same way, with the typed
    // entry left in the field.
    if (nameTaken(current, resolved.name, -1)) {
      setAddError(`Another player is already named ${resolved.name}`);
      return;
    }
    if (!onApplyPlayers([...current, resolved], [...current.map((_, seat) => seat), -1])) {
      // Refused — a save opened during the lookup. Leave what was typed where it is.
      return;
    }
    setAddError('');
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

  // Positional, because that is what a seat is: two players can carry the same name while a
  // duplicate is being corrected, and a drag id has to be unique.
  const seatIds = useMemo(() => players.map((_, index) => `seat-${index}`), [players]);

  const reorderPlayers = useCallback(
    ({ active, over }: { active: { id: string }; over: { id: string } | null }) => {
      if (editsDisabled || !seatsEditable || !over || active.id === over.id) {
        return;
      }
      const from = seatIds.indexOf(active.id);
      const to = seatIds.indexOf(over.id);
      if (from === -1 || to === -1) {
        return;
      }
      const order = arrayMove(identitySeats(), from, to);
      if (
        !onApplyPlayers(
          order.map((seat) => players[seat]),
          order,
        )
      ) {
        return;
      }
      // Unlike a shuffle, a drag moves one row the user is looking at, so the open body
      // follows its player rather than being thrown away. order[position] is the seat that
      // landed there, so looking the open seat up in it gives where that player now sits —
      // and a closed list, -1, is not in it and stays closed.
      setExpanded(order.indexOf(expanded));
    },
    [editsDisabled, seatsEditable, seatIds, identitySeats, onApplyPlayers, players, expanded],
  );

  const renamePlayer = useCallback(
    async (index: number, raw: string): Promise<Player | null | undefined | typeof COLLISION> => {
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
      // Refused rather than applied. applyPlayerEdit rewrites every key derived from a
      // player's name, so landing a collision rewrites the other player's pairings,
      // trophy and override onto the shared name — and correcting the typo afterwards
      // renames the merged result back, leaving no duplicate to report and nothing to
      // restore. The field keeps the typed text, so nothing the user wrote is lost.
      if (nameTaken(current, resolved.name, seat)) {
        return COLLISION;
      }
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
            <Flexbox direction="col" gap="1">
              <Flexbox direction="row" gap="2" alignItems="center" wrap="wrap">
                <Input
                  value={newPlayer}
                  onChange={(event) => {
                    setNewPlayer(event.target.value);
                    setAddError('');
                  }}
                  onEnter={addPlayer}
                  placeholder="Add a player (@ to link an account)"
                  wrapperClassName="w-64"
                  valid={addError ? false : undefined}
                />
                <Button color="primary" onClick={addPlayer}>
                  <span className="text-nowrap">Add Player</span>
                </Button>
                <Button color="accent" onClick={shufflePlayers}>
                  <span className="text-nowrap">Shuffle Players</span>
                </Button>
              </Flexbox>
              {addError && (
                <Text sm className="text-danger">
                  {addError}
                </Text>
              )}
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

      {players.length > 0 && (
        // Column headings rather than a sentence: the three cells on each row carry no visible
        // label, and a caption that is not the width of the column it describes does not point
        // at anything. Each heading is `w-20` like the cell beneath it, right-aligned to the
        // same card padding, so the three columns read top to bottom.
        <div data-testid="record-column-headings" className="px-4">
          {/* Mirrors a row's own layout element for element — the handle and avatar it leads
              with, then the name, then every fixed column, then the two icons it ends with —
              because a heading that is not over its column is a caption, not a heading. */}
          <Flexbox direction="row" gap="2" alignItems="center">
            {seatsEditable && <span aria-hidden="true" className="w-4 shrink-0" />}
            <span aria-hidden="true" className="w-6 shrink-0" />
            <Text sm semibold className="grow min-w-0 text-text-secondary">
              Name
            </Text>
            <Text sm semibold className={`${DECK_COLUMN} shrink-0 text-center text-text-secondary`}>
              Main / Side
            </Text>
            <Flexbox direction="row" gap="1" alignItems="center">
              {RECORD_FIELDS.map(({ label, key }) => (
                <Text key={key} sm semibold className={`${RECORD_COLUMN} text-text-secondary`}>
                  {label.charAt(0)}
                </Text>
              ))}
            </Flexbox>
            <span aria-hidden="true" className="w-4 shrink-0" />
            <span aria-hidden="true" className="w-4 shrink-0" />
          </Flexbox>
        </div>
      )}

      {/* The rows stay sortable on a played draft too: what is withheld there is the handle,
          and with no handle rendered there is nothing to start a drag from. That keeps one
          piece of row markup rather than an editable and a read-only copy of it. */}
      <SortableList items={seatIds} onDragEnd={reorderPlayers}>
        {players.map((player, index) => {
          const deck = decks[index];
          const open = expanded === index;
          const linked = linkedUsers.find((user) => user.id === player.userId);
          const held = (record.trophy ?? []).includes(player.name);
          const duplicate = players.some(
            (other, seat) => seat !== index && other.name.toLowerCase() === player.name.toLowerCase(),
          );
          const override = overrides[player.name];

          return (
            // The caller-supplied role is what keeps dnd-kit's own button attributes off this
            // wrapper, so the drag lives on the handle's listeners and the row neither becomes
            // a tab stop nor announces the whole of itself as draggable.
            <SortableItem key={index} id={seatIds[index]} role="presentation">
              {({ handleProps }) => (
                <div data-testid="transcribe-player-row">
                  <Card>
                    <CardHeader>
                      <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap">
                        {seatsEditable && (
                          // The one drag surface, and it is on the collapsed row: the body below
                          // holds the name field and the paste box, and a drag begun in either of
                          // those would start a sort in the middle of typing.
                          <span
                            {...handleProps}
                            role="img"
                            aria-label={`Drag ${player.name} to reorder`}
                            className="cursor-grab text-text-secondary shrink-0"
                          >
                            <GrabberIcon size={16} />
                          </span>
                        )}
                        {/* The identity half is not a control. Awarding a trophy and expanding
                            the row both live here, and an unmarked stretch of header that
                            swallows clicks is indistinguishable from one that is merely
                            decorative — so the chevron below is the only way to open a row. */}
                        <Flexbox direction="row" alignItems="center" gap="2" className="min-w-0 grow">
                          {linked?.image?.uri ? (
                            <img src={linked.image.uri} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-bg-active border border-border shrink-0" />
                          )}
                          <PlayerNameField
                            id={`transcribe-player-name-${index}`}
                            player={player}
                            duplicate={duplicate}
                            disabled={editsDisabled}
                            onRename={(raw) => renamePlayer(index, raw)}
                          />
                        </Flexbox>
                        <Flexbox direction="row" alignItems="center" gap="2" wrap="wrap">
                          {/* Left of the deck column, not between it and the cells: these appear
                              only on a row carrying an override, and anything of varying width
                              in between would shunt that row's counts out of their column. */}
                          <OverrideControls
                            player={player}
                            derived={playerRecord(withoutOverrides, player.name)}
                            override={override}
                            hasPairings={hasPairings}
                            clearOverride={() => setOverride(player.name, undefined)}
                          />
                          <DeckCounts deck={deck} />
                          <PlayerRecord
                            player={player}
                            derived={playerRecord(withoutOverrides, player.name)}
                            override={override}
                            editable={resultsMode === 'records'}
                            setOverride={(value) => setOverride(player.name, value)}
                          />
                          {/* Always rendered, lit when held: a trophy that only appears once
                              awarded gives no affordance for awarding it in the first place. */}
                          <button
                            type="button"
                            disabled={editsDisabled}
                            aria-pressed={held}
                            aria-label={`${held ? 'Remove' : 'Award'} trophy for ${player.name}`}
                            className={`shrink-0 ${held ? 'text-yellow-500' : 'text-text-secondary opacity-40'}`}
                            onClick={() => toggleTrophy(player.name, !held)}
                          >
                            <TrophyIcon size={16} />
                          </button>
                          {/* Rightmost, and fixed width, so inserting it leaves the record cells
                              on the same x as every other row's. */}
                          <button
                            type="button"
                            data-testid="expand-indicator"
                            className="shrink-0 text-text-secondary"
                            onClick={() => setExpanded(open ? -1 : index)}
                            aria-expanded={open}
                            aria-label={`${open ? 'Collapse' : 'Expand'} ${player.name}`}
                          >
                            {open ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
                          </button>
                        </Flexbox>
                      </Flexbox>
                    </CardHeader>
                    {open && (
                      <CardBody>
                        <Flexbox direction="col" gap="3">
                          {/* A save rewrites the draft's seats into the submitted player order,
                              and the page re-bases seatOrder to identity once it lands. Holding
                              every player edit shut for the length of the request is what makes
                              that re-base unambiguous: a rename, add, remove, shuffle or drop
                              applied mid-flight would be expressed against seats the server has
                              already moved, and the next save would misattribute every deck. */}
                          {!deck || deck.editable ? (
                            <Flexbox direction="col" gap="2">
                              <UploadDeck
                                // Whose deck this is, is the row it is in.
                                selectedUser={1}
                                setSelectedUser={() => {}}
                                showPlayerPicker={false}
                                // deck.editable is areSeatsEditable(draft), the same value
                                // seatsEditable holds — so a row whose deck cannot be edited
                                // has no remove control to place, and this branch is the only
                                // one that ever needs to carry it.
                                controlsExtra={
                                  seatsEditable && (
                                    <fieldset disabled={editsDisabled} className="border-0 p-0 m-0">
                                      <Button
                                        color="danger"
                                        aria-label={`Remove ${player.name}`}
                                        onClick={() => removePlayer(index)}
                                      >
                                        <span className="text-nowrap">Remove player</span>
                                      </Button>
                                    </fieldset>
                                  )
                                }
                                photoScanner={
                                  <UploadDeckFromPhoto
                                    cube={cube}
                                    setMainboardCards={setters[index].setMainboard}
                                    setSideboardCards={setters[index].setSideboard}
                                    setAlerts={setAlerts}
                                  />
                                }
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
                                This record is attached to a played draft, so this deck is tied to the seat that drafted
                                it and cannot be re-entered here.
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
              )}
            </SortableItem>
          );
        })}
      </SortableList>
    </Flexbox>
  );
};

export default TranscribePlayers;
