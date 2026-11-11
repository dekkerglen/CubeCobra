import React, { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';

import { DashIcon, PlusIcon } from '@primer/octicons-react';
import Record, { Match } from '@utils/datatypes/Record';
import { isReservedName, playersWithMatches } from '@utils/records/roundChecks';

import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import { Tabs } from 'components/base/Tabs';
import Text from 'components/base/Text';
import TextArea from 'components/base/TextArea';
import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';
import { CSRFContext } from 'contexts/CSRFContext';

import {
  MAX_SEATS,
  MIN_SEATS,
  nameTaken,
  occupied,
  parsePlayerList,
  resizeTable,
  roundOneOpponent,
  roundOnePairings,
  Seat,
  SeatedPlayer,
  seatPlayers,
  seatsFromPlayers,
  setSeat,
  shuffleSeats,
  swapSeats,
  tableSubmission,
} from './seating';
import PairingMethodControl from './PairingMethodControl';
import SeatingTable, { PairingList } from './SeatingTable';

// What a name field shows for a player: linked accounts keep the @ they were typed with.
const displayName = (player?: SeatedPlayer): string => (player ? `${player.userId ? '@' : ''}${player.name}` : '');

// A leading @ links the player to a CubeCobra account, as everywhere else players are entered.
const useResolvePlayer = () => {
  const { csrfFetch } = useContext(CSRFContext);
  return useCallback(
    async (raw: string): Promise<SeatedPlayer | null> => {
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

interface SeatEditorProps {
  seats: Seat[];
  pairings: Match[] | null;
  // Players who have been in a match: they can move seats or be renamed, but not leave.
  locked: Set<string>;
  index: number;
  focusOnSelect: boolean;
  // `advance` moves on to the next empty chair, for Enter; leaving the field just saves it.
  onCommit: (index: number, player: SeatedPlayer | undefined, advance?: boolean) => void;
  onSwap: (from: number, to: number) => void;
}

// The selected chair: who sits there, who they face in round one, and moving them elsewhere.
const SeatEditor: React.FC<SeatEditorProps> = ({ seats, pairings, locked, index, focusOnSelect, onCommit, onSwap }) => {
  const resolvePlayer = useResolvePlayer();
  const inputRef = useRef<HTMLInputElement>(null);
  const swapId = useId();
  const seat = seats[index]!;
  const [text, setText] = useState(displayName(seat.player));
  const [error, setError] = useState<string | null>(null);

  // A different chair, or the same chair given someone else by a shuffle, starts the field over.
  useEffect(() => {
    setText(displayName(seat.player));
    setError(null);
    if (focusOnSelect) {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, seat.player]);

  const commit = async (advance: boolean) => {
    if (text.trim() === displayName(seat.player)) {
      return;
    }
    const player = await resolvePlayer(text);
    if (player && isReservedName(player.name)) {
      setError(`"${player.name}" is used by pairings, so it can't be a player's name.`);
      return;
    }
    if (!player && seat.player && locked.has(seat.player.name)) {
      setError(
        `${seat.player.name} has played in this event, so can't be removed. Drop them from the Standings tab instead.`,
      );
      return;
    }
    if (player && nameTaken(seats, player.name, index)) {
      setError(`${player.name} already has a seat.`);
      return;
    }
    setError(null);
    onCommit(index, player ?? undefined, advance);
  };

  const opponent = pairings ? roundOneOpponent(seats, index, pairings) : null;
  const roundOne =
    opponent === 'bye'
      ? 'Has the bye in round one.'
      : typeof opponent === 'number' && opponent >= 0
        ? `Plays ${seats[opponent]!.player!.name} (seat ${opponent + 1}) in round one.`
        : null;

  return (
    <Flexbox direction="col" gap="2">
      <Text semibold>{`Seat ${index + 1}`}</Text>
      <Input
        innerRef={inputRef}
        placeholder="Name, or @username to link an account"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onEnter={() => commit(true)}
        otherInputProps={{
          'aria-label': `Player in seat ${index + 1}`,
          onBlur: () => commit(false),
          // A player's name, not a login: keeps password managers from offering to fill it.
          autoComplete: 'off',
          ...{ 'data-1p-ignore': true, 'data-lpignore': 'true' },
        }}
        valid={error ? false : undefined}
      />
      {error && (
        <Text sm className="text-danger">
          {error}
        </Text>
      )}
      {roundOne && (
        <Text sm className="text-text-secondary">
          {roundOne}
        </Text>
      )}
      <Flexbox direction="row" gap="2" alignItems="center" wrap="wrap">
        {seat.player && (
          <>
            <label htmlFor={swapId} className="text-sm text-text-secondary">
              Move to
            </label>
            <select
              id={swapId}
              className="rounded-md border border-border bg-bg px-2 py-1 text-sm"
              value=""
              onChange={(event) => onSwap(index, Number(event.target.value))}
            >
              <option value="" disabled>
                another seat…
              </option>
              {seats.map((other, otherIndex) =>
                otherIndex === index ? null : (
                  <option key={otherIndex} value={otherIndex}>
                    {`Seat ${otherIndex + 1}${other.player ? ` (swap with ${other.player.name})` : ''}`}
                  </option>
                ),
              )}
            </select>
            {locked.has(seat.player.name) ? (
              <Text xs className="text-text-secondary">
                Has played, so stays in the event. Drop them from Standings to stop pairing them.
              </Text>
            ) : (
              <button
                type="button"
                className="text-sm font-medium text-danger hover:underline"
                onClick={() => onCommit(index, undefined)}
              >
                Clear Seat
              </button>
            )}
          </>
        )}
      </Flexbox>
    </Flexbox>
  );
};

interface SetTheTableProps {
  record: Record;
  // Shown under the Save button, e.g. a Cancel in a modal.
  footer?: React.ReactNode;
}

/**
 * Seats a record's players around a draft table, either chair by chair or by pasting the list
 * and letting the table seat everyone. Seat order is the record's player order. Until the record
 * has a round, the table also pairs round one, across the table or at random, and can save the
 * seating and that round together.
 */
const SetTheTable: React.FC<SetTheTableProps> = ({ record, footer }) => {
  const resolvePlayer = useResolvePlayer();
  const formRef = useRef<HTMLFormElement>(null);
  const pairFormRef = useRef<HTMLFormElement>(null);
  const listId = useId();
  const [seats, setSeats] = useState<Seat[]>(() => seatsFromPlayers(record.players));
  const [mode, setMode] = useState<'table' | 'list'>(record.players.length === 0 ? 'list' : 'table');
  const [selected, setSelected] = useState<number | null>(null);
  // Only move focus into the seat field once someone has picked a chair, never on page load.
  const [interacted, setInteracted] = useState(false);
  const [listText, setListText] = useState(() => record.players.map((player) => displayName(player)).join('\n'));
  const [listMessage, setListMessage] = useState<string | null>(null);
  const [seating, setSeating] = useState(false);
  const [roundOneStyle, setRoundOneStyle] = useState<'across' | 'random'>('across');
  const [drawSeed, setDrawSeed] = useState(() => Math.floor(Math.random() * 2 ** 32));

  const submission = useMemo(() => tableSubmission(seats), [seats]);
  const locked = useMemo(() => playersWithMatches(record), [record]);
  // The roster every origin above refers to, so a change made elsewhere since is caught.
  const expectedPlayers = JSON.stringify(record.players.map((player) => player.name));
  // Players with matches whom the seating leaves out, as a pasted list can: saving would refuse.
  const missing = [...locked].filter(
    (name) =>
      record.players.some((player) => player.name === name) &&
      !seats.some((seat) => seat.player && seat.origin >= 0 && record.players[seat.origin]?.name === name),
  );
  const pairsRoundOne = !(record.matches ?? []).some((round) => round.matches.length > 0);
  const pairings = useMemo(
    () => (pairsRoundOne ? roundOnePairings(seats, roundOneStyle, drawSeed) : null),
    [pairsRoundOne, seats, roundOneStyle, drawSeed],
  );
  const unchanged =
    submission.players.length === record.players.length &&
    submission.seatOrder.every((origin, index) => origin === index) &&
    submission.players.every(
      (player, index) => player.name === record.players[index]?.name && player.userId === record.players[index]?.userId,
    );

  const select = (index: number) => {
    setInteracted(true);
    setSelected(index);
  };

  const commitSeat = (index: number, player: SeatedPlayer | undefined, advance = false) => {
    const next = setSeat(seats, index, player);
    setSeats(next);
    // Enter on a chair just filled moves on to the next empty one, so a queue of people at the
    // door can be typed in one after another without touching the mouse.
    if (advance && player && !seats[index]!.player) {
      const nextEmpty = next.findIndex((seat, position) => position > index && !seat.player);
      const wrapped = nextEmpty >= 0 ? nextEmpty : next.findIndex((seat) => !seat.player);
      if (wrapped >= 0) {
        setSelected(wrapped);
      }
    }
  };

  const swap = (from: number, to: number) => {
    setSeats((previous) => swapSeats(previous, from, to));
    setSelected(to);
  };

  const seatFromList = async (order: 'listed' | 'random') => {
    const parsed = parsePlayerList(listText);
    const reserved = parsed.names.filter((name) => isReservedName(name.replace(/^@/, '')));
    const names = parsed.names.filter((name) => !reserved.includes(name));
    const { duplicates } = parsed;
    if (names.length === 0) {
      setListMessage('Add at least one name.');
      return;
    }
    setSeating(true);
    try {
      const resolved = (await Promise.all(names.map((name) => resolvePlayer(name)))).filter(
        (player): player is SeatedPlayer => player !== null,
      );
      setSeats(seatPlayers(resolved, seats, order));
      const notes = [
        ...(duplicates.length > 0 ? [`Skipped a repeated name: ${duplicates.join(', ')}.`] : []),
        ...(reserved.length > 0 ? [`Skipped ${reserved.join(', ')}: pairings use that name.`] : []),
        ...(names.length > MAX_SEATS ? [`A table seats at most ${MAX_SEATS}; the rest were left out.`] : []),
      ];
      setListMessage(notes.length > 0 ? notes.join(' ') : null);
      setSelected(null);
      setMode('table');
    } finally {
      setSeating(false);
    }
  };

  return (
    <Flexbox direction="col" gap="3">
      <Tabs
        className="border-b border-border"
        activeTab={mode === 'table' ? 0 : 1}
        tabs={[
          { label: 'Seat by seat', onClick: () => setMode('table') },
          { label: 'From a list', onClick: () => setMode('list') },
        ]}
      />

      {mode === 'list' ? (
        <Flexbox direction="col" gap="2">
          <TextArea
            id={listId}
            label="Players"
            rows={8}
            placeholder={'Alice\nBob\n@username'}
            value={listText}
            onChange={(event) => setListText(event.target.value)}
          />
          <Text sm className="text-text-secondary">
            One player per line. Start a name with @ to link their CubeCobra account.
          </Text>
          {listMessage && <Text sm>{listMessage}</Text>}
          <Flexbox direction="row" gap="2" wrap="wrap">
            <Button color="primary" onClick={() => seatFromList('random')} disabled={seating}>
              Seat Randomly
            </Button>
            <Button color="secondary" outline onClick={() => seatFromList('listed')} disabled={seating}>
              Seat in Order
            </Button>
          </Flexbox>
        </Flexbox>
      ) : (
        <Flexbox direction="col" gap="4" className="md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <SeatingTable
              seats={seats}
              pairings={pairings}
              selected={selected}
              onSelect={select}
              onSwap={swap}
              center={
                <>
                  <Text
                    xxl
                    semibold
                    className="rounded-md bg-bg-active px-2"
                  >{`${occupied(seats)} / ${seats.length}`}</Text>
                  <Text xs className="text-text-secondary">
                    seated
                  </Text>
                </>
              }
            />
          </div>
          <Flexbox direction="col" gap="3" className="md:w-72 md:shrink-0">
            {selected !== null && seats[selected] ? (
              <SeatEditor
                seats={seats}
                pairings={pairings}
                locked={locked}
                index={selected}
                focusOnSelect={interacted}
                onCommit={commitSeat}
                onSwap={swap}
              />
            ) : (
              <Text sm className="text-text-secondary">
                Pick a chair to seat someone. Drag one player onto another chair to move them.
              </Text>
            )}
            {listMessage && <Text sm>{listMessage}</Text>}
            <Flexbox direction="row" gap="2" alignItems="center" wrap="wrap">
              <Text sm className="text-text-secondary">
                Seats
              </Text>
              <button
                type="button"
                aria-label="Remove a seat"
                className="rounded border border-border p-1 hover:bg-bg-active disabled:opacity-50"
                disabled={seats.length <= Math.max(MIN_SEATS, occupied(seats))}
                onClick={() => {
                  setSeats((previous) => resizeTable(previous, previous.length - 1));
                  setSelected(null);
                }}
              >
                <DashIcon size={16} />
              </button>
              <Text sm semibold>
                {seats.length}
              </Text>
              <button
                type="button"
                aria-label="Add a seat"
                className="rounded border border-border p-1 hover:bg-bg-active disabled:opacity-50"
                disabled={seats.length >= MAX_SEATS}
                onClick={() => setSeats((previous) => resizeTable(previous, previous.length + 1))}
              >
                <PlusIcon size={16} />
              </button>
              <Button color="secondary" outline onClick={() => setSeats((previous) => shuffleSeats(previous))}>
                Shuffle Seats
              </Button>
            </Flexbox>
            {pairings && (
              <Flexbox direction="col" gap="2" className="border-t border-border pt-3">
                <Text semibold>Round one</Text>
                <PairingMethodControl
                  methods={['across', 'random']}
                  value={roundOneStyle}
                  onChange={(method) => setRoundOneStyle(method === 'random' ? 'random' : 'across')}
                  onRedraw={() => setDrawSeed((seed) => seed + 1)}
                />
                <PairingList
                  seats={seats}
                  pairings={pairings}
                  label="Round one pairings"
                  emptyMessage="Seat at least two players to pair round one."
                />
              </Flexbox>
            )}
          </Flexbox>
        </Flexbox>
      )}

      {missing.length > 0 && (
        <Text sm className="text-danger">
          {`${missing.join(', ')} ${missing.length === 1 ? 'has' : 'have'} played in this event, so ${missing.length === 1 ? 'needs' : 'need'} a seat. Drop players from the Standings tab instead of removing them.`}
        </Text>
      )}
      {!pairings && record.players.length > 0 && (
        <Text xs className="text-text-secondary">
          Rounds are already paired, so moving players between seats doesn't change any pairing.
        </Text>
      )}
      {pairings && (
        <LoadingButton
          color="primary"
          block
          onClick={() => pairFormRef.current?.submit()}
          disabled={mode !== 'table' || pairings.length === 0 || missing.length > 0}
        >
          Save and Pair Round One
        </LoadingButton>
      )}
      <LoadingButton
        color={pairings ? 'secondary' : 'primary'}
        outline={Boolean(pairings)}
        block
        onClick={() => formRef.current?.submit()}
        disabled={submission.players.length === 0 || unchanged || missing.length > 0}
      >
        {pairings ? 'Save Seating Only' : 'Save Seating'}
      </LoadingButton>
      {footer}
      <CSRFForm
        method="POST"
        action={`/cube/records/edit/players/${record.id}`}
        formData={{
          players: JSON.stringify(submission.players),
          seatOrder: JSON.stringify(submission.seatOrder),
          expectedPlayers,
        }}
        ref={formRef}
      />
      {pairings && (
        <CSRFForm
          method="POST"
          action={`/cube/records/edit/players/${record.id}`}
          formData={{
            players: JSON.stringify(submission.players),
            seatOrder: JSON.stringify(submission.seatOrder),
            expectedPlayers,
            firstRound: JSON.stringify({ matches: pairings }),
          }}
          ref={pairFormRef}
        />
      )}
    </Flexbox>
  );
};

export default SetTheTable;
