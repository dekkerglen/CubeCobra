import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import Record, { applyPlayerRenames, PlayerList, WinLossDraw } from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';

import Alert, { UncontrolledAlertProps } from 'components/base/Alert';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

import EditDescription from '../records/EditDescription';
import TranscribeDecks, { DeckBoard } from '../records/transcribe/TranscribeDecks';
import TranscribePlayerRail from '../records/transcribe/TranscribePlayerRail';
import TranscribeResults, { MAX_ROUNDS } from '../records/transcribe/TranscribeResults';
import {
  isDirty,
  seedTranscribeState,
  toTranscribePayload,
  TranscribeDeck,
  TranscribeState,
} from '../records/transcribe/transcribeState';

// Mirrors the endpoint's Joi schema. Every one of these is a 400 the user would otherwise
// only see after typing out a whole event, so Save is held back until they are satisfied.
const MAX_PLAYERS = 16;
const MAX_DECK_CARDS = 200;

interface RecordTranscribePageProps {
  cube: Cube;
  record: Record;
  draft?: Draft;
  players: User[];
}

interface Workspace {
  state: TranscribeState;
  // What the record looked like when it was loaded, or when the last save landed. isDirty
  // compares against it, so it has to move only when the server has caught up.
  seeded: TranscribeState;
}

const clearedDecks = (
  decks: { [playerIndex: number]: TranscribeDeck },
  wasSubmitted: (playerIndex: number, deck: TranscribeDeck) => boolean,
): { [playerIndex: number]: TranscribeDeck } => {
  const next: { [playerIndex: number]: TranscribeDeck } = {};
  for (const [key, deck] of Object.entries(decks)) {
    const index = Number(key);
    next[index] = deck.dirty && wasSubmitted(index, deck) ? { ...deck, dirty: false } : deck;
  }
  return next;
};

const RecordTranscribePage: React.FC<RecordTranscribePageProps> = ({ cube, record, draft, players }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    const seeded = seedTranscribeState(record, draft);
    return { state: seeded, seeded };
  });
  const [alerts, setAlerts] = useState<UncontrolledAlertProps[]>([]);
  const [saveError, setSaveError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [savedMessage, setSavedMessage] = useState<string>('');

  const { state, seeded } = workspace;

  const updateState = useCallback((update: (previous: TranscribeState) => TranscribeState) => {
    setWorkspace((previous) => ({ ...previous, state: update(previous.state) }));
  }, []);

  // Every seat is editable or none is, so the first one answers for the record.
  const seatsEditable = state.decks[0]?.editable ?? true;

  // The live state as a Record, so the rail and the results section can use playerRecord,
  // formatRecord and EditTrophies rather than reimplementing them against TranscribeState.
  const liveRecord: Record = useMemo(
    () => ({
      ...record,
      name: state.name,
      date: state.date,
      description: state.description,
      players: state.players,
      matches: state.matches,
      trophy: state.trophy,
      overrides: Object.fromEntries(
        Object.entries(state.overrides).filter(([, value]) => !!value),
      ) as Record['overrides'],
    }),
    [record, state.name, state.date, state.description, state.players, state.matches, state.trophy, state.overrides],
  );

  // Deck edits are refused for a seat the record does not own. One stray dirty flag on a
  // played draft's seat makes the server reject the entire save, overview and pairings
  // included, so the guard lives here rather than only in what gets rendered.
  const setDeckBoard = useCallback(
    (playerIndex: number, board: DeckBoard, update: React.SetStateAction<CardDetails[]>) =>
      updateState((previous) => {
        const deck = previous.decks[playerIndex];
        if (!deck || !deck.editable) {
          return previous;
        }
        const cards = typeof update === 'function' ? update(deck[board]) : update;
        return {
          ...previous,
          decks: { ...previous.decks, [playerIndex]: { ...deck, [board]: cards, dirty: true } },
        };
      }),
    [updateState],
  );

  // The edited player list, plus the seat each entry came from in the list the editor was
  // opened on. Everything keyed by player — standings, trophies, pairings — is re-keyed from
  // that mapping here: the endpoint drops any key that is not a submitted player name, so a
  // rename that stopped at the player list would quietly throw that player's results away.
  const applyPlayers = useCallback(
    (edited: PlayerList, originSeats: number[]) =>
      updateState((previous) => {
        const renames = new Map<string, string>();
        edited.forEach((player, index) => {
          const origin = originSeats[index];
          const before = origin >= 0 ? previous.players[origin]?.name : undefined;
          if (before && before !== player.name) {
            renames.set(before, player.name);
          }
        });

        // applyPlayerRenames takes the whole mapping at once, so a straight swap of two
        // names resolves against the originals instead of chaining through itself.
        const renamed = {
          matches: previous.matches,
          trophy: previous.trophy,
          overrides: { ...previous.overrides },
        } as Record;
        applyPlayerRenames(renamed, renames);

        const names = new Set(edited.map((player) => player.name));
        const overrides: TranscribeState['overrides'] = {};
        for (const [name, value] of Object.entries(renamed.overrides ?? {})) {
          if (names.has(name)) {
            overrides[name] = value;
          }
        }

        const decks: { [playerIndex: number]: TranscribeDeck } = {};
        edited.forEach((_, index) => {
          const origin = originSeats[index];
          decks[index] = (origin >= 0 ? previous.decks[origin] : undefined) ?? {
            mainboard: [],
            sideboard: [],
            dirty: false,
            editable: seatsEditable,
          };
        });

        return {
          ...previous,
          players: edited,
          // originSeats indexes the list as it stood; seatOrder has to keep pointing at the
          // draft seats the record was loaded with.
          seatOrder: originSeats.map((origin) => (origin >= 0 ? (previous.seatOrder[origin] ?? -1) : -1)),
          matches: renamed.matches,
          trophy: (renamed.trophy ?? []).filter((name) => names.has(name)),
          overrides,
          decks,
        };
      }),
    [updateState, seatsEditable],
  );

  const setOverride = useCallback(
    (playerName: string, value: WinLossDraw | undefined) =>
      updateState((previous) => ({ ...previous, overrides: { ...previous.overrides, [playerName]: value } })),
    [updateState],
  );

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!state.name.trim()) {
      errors.push('Give this record a name.');
    }
    if (!Number.isFinite(state.date)) {
      errors.push('Give this record a date.');
    }
    if (state.players.length > MAX_PLAYERS) {
      errors.push(`A record holds at most ${MAX_PLAYERS} players, and this one has ${state.players.length}.`);
    }

    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const player of state.players) {
      const key = player.name.toLowerCase();
      if (seen.has(key)) {
        duplicates.add(player.name);
      }
      seen.add(key);
    }
    if (duplicates.size > 0) {
      errors.push(`Two players cannot share a name: ${[...duplicates].join(', ')}.`);
    }

    if (state.matches.length > MAX_ROUNDS) {
      errors.push(`A record holds at most ${MAX_ROUNDS} rounds, and this one has ${state.matches.length}.`);
    }

    // Only an edited deck is submitted, so only an edited deck can be rejected for its size.
    for (const [key, deck] of Object.entries(state.decks)) {
      if (!deck.dirty) {
        continue;
      }
      const name = state.players[Number(key)]?.name ?? `Seat ${Number(key) + 1}`;
      if (deck.mainboard.length > MAX_DECK_CARDS) {
        errors.push(`${name}'s mainboard has ${deck.mainboard.length} cards, over the ${MAX_DECK_CARDS} limit.`);
      }
      if (deck.sideboard.length > MAX_DECK_CARDS) {
        errors.push(`${name}'s sideboard has ${deck.sideboard.length} cards, over the ${MAX_DECK_CARDS} limit.`);
      }
    }

    return errors;
  }, [state]);

  const dirty = useMemo(() => isDirty(state, seeded), [state, seeded]);

  useEffect(() => {
    if (!dirty) {
      return undefined;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  const save = useCallback(async () => {
    const submitted = state;
    setSaving(true);
    setSaveError('');
    setSavedMessage('');

    try {
      const response = await csrfFetch(`/cube/records/enter/${record.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toTranscribePayload(submitted)),
      });
      const json = await response.json();

      if (json.success !== 'true') {
        // The page stays exactly as it is — the whole point of saving over JSON rather than
        // a redirecting form post is that a rejection costs the user none of their typing.
        setSaveError(json.message || 'Could not save this record.');
        return;
      }

      setWorkspace((previous) => {
        const wasSubmitted = (index: number, deck: TranscribeDeck) => submitted.decks[index] === deck;
        // The server realigned the draft's seats into the submitted order, so every player
        // now sits where they are listed. Only re-base when the list has not moved again
        // since: an edit made while the request was in flight is still expressed against the
        // seats the record was loaded with.
        const identity = submitted.players.map((_, index) => index);
        const settled = {
          ...submitted,
          seatOrder: identity,
          decks: clearedDecks(submitted.decks, wasSubmitted),
        };
        return {
          state: {
            ...previous.state,
            ...(previous.state.seatOrder === submitted.seatOrder ? { seatOrder: identity } : {}),
            decks: clearedDecks(previous.state.decks, wasSubmitted),
          },
          seeded: settled,
        };
      });
      setSavedMessage('Record saved.');
    } catch {
      setSaveError('Could not save this record. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [csrfFetch, record.id, state]);

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} activeLink="records">
        <DynamicFlash />
        <Card className="my-2">
          <CardHeader>
            <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap">
              <Text lg semibold>
                {`Enter event data: ${record.name}`}
              </Text>
              <Link href={`/cube/record/${record.id}`}>Back to the record</Link>
            </Flexbox>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="4">
              <Text sm className="text-text-secondary">
                Enter a whole event here — the overview, who played, their decks and how the rounds went — and commit it
                all with one Save.
              </Text>

              <EditDescription
                value={{ name: state.name, date: state.date, description: state.description }}
                setValue={(value) =>
                  updateState((previous) => ({
                    ...previous,
                    name: value.name ?? '',
                    // A cleared date field reports undefined. Keeping it as NaN rather than
                    // falling back to a number leaves it visibly unset and fails validation,
                    // instead of silently dating the record to the epoch.
                    date: value.date ?? NaN,
                    description: value.description ?? '',
                  }))
                }
              />

              <Flexbox direction="col" gap="2">
                <Text lg semibold>
                  Players
                </Text>
                <TranscribePlayerRail
                  record={liveRecord}
                  linkedUsers={players}
                  decks={state.decks}
                  setTrophy={(trophy) => updateState((previous) => ({ ...previous, trophy }))}
                  seatsEditable={seatsEditable}
                  onApplyPlayers={applyPlayers}
                />
              </Flexbox>

              <Flexbox direction="col" gap="2">
                <Text lg semibold>
                  Decks
                </Text>
                <TranscribeDecks
                  cube={cube}
                  record={liveRecord}
                  decks={state.decks}
                  setDeckBoard={setDeckBoard}
                  setAlerts={setAlerts}
                />
              </Flexbox>

              <Flexbox direction="col" gap="2">
                <Text lg semibold>
                  Results
                </Text>
                <TranscribeResults
                  players={state.players}
                  matches={state.matches}
                  setMatches={(matches) => updateState((previous) => ({ ...previous, matches }))}
                  overrides={state.overrides}
                  setOverride={setOverride}
                />
              </Flexbox>

              {alerts.map(({ color, message }, index) => (
                <Alert key={index} color={color}>
                  {message}
                </Alert>
              ))}
            </Flexbox>
          </CardBody>
        </Card>

        <div className="sticky bottom-0 z-10 border-t border-border bg-bg p-3">
          <Flexbox direction="col" gap="2">
            {validationErrors.length > 0 && (
              <Alert color="warning">
                <ul className="mb-0">
                  {validationErrors.map((error) => (
                    <li key={error}>
                      <Text sm>{error}</Text>
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
            {saveError && (
              <Alert color="danger">
                <Text sm>{saveError}</Text>
              </Alert>
            )}
            {savedMessage && !dirty && (
              <Alert color="success">
                <Text sm>{savedMessage}</Text>
              </Alert>
            )}
            <Flexbox direction="row" justify="between" alignItems="center" gap="2">
              <Text sm className="text-text-secondary">
                {dirty ? 'Unsaved changes' : 'No unsaved changes'}
              </Text>
              <Button color="primary" onClick={save} disabled={!dirty || saving || validationErrors.length > 0}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </Flexbox>
          </Flexbox>
        </div>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(RecordTranscribePage);
