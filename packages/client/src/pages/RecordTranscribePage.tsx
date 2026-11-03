import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import Record, { PlayerList, WinLossDraw } from '@utils/datatypes/Record';
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
import TranscribeDecks from '../records/transcribe/TranscribeDecks';
import TranscribePlayerRail from '../records/transcribe/TranscribePlayerRail';
import TranscribeResults from '../records/transcribe/TranscribeResults';
import {
  applyPlayerEdit,
  areSeatsEditable,
  CardsUpdate,
  DeckBoard,
  isDirty,
  seedTranscribeState,
  setDeckCards,
  toTranscribePayload,
  TranscribeDeck,
  TranscribeState,
  validationErrors,
} from '../records/transcribe/transcribeState';

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

  // The draft answers for the whole record: the state module seeds every seat's editable
  // flag from exactly this, so a zero-player record cannot drift from its seats.
  const seatsEditable = areSeatsEditable(draft);

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

  const setDeckBoard = useCallback(
    (playerIndex: number, board: DeckBoard, update: CardsUpdate) =>
      updateState((previous) => setDeckCards(previous, playerIndex, board, update)),
    [updateState],
  );

  const applyPlayers = useCallback(
    (edited: PlayerList, originSeats: number[]) =>
      updateState((previous) => applyPlayerEdit(previous, edited, originSeats, seatsEditable)),
    [updateState, seatsEditable],
  );

  const setOverride = useCallback(
    (playerName: string, value: WinLossDraw | undefined) =>
      updateState((previous) => ({ ...previous, overrides: { ...previous.overrides, [playerName]: value } })),
    [updateState],
  );

  const errors = useMemo(() => validationErrors(state), [state]);

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
        // The server rewrote the draft's seats into the submitted player order, so every
        // player now sits where they are listed and identity is the only correct seatOrder
        // for the next save. The rail holds every player edit shut for the length of the
        // request, so no other permutation can have been created in the meantime — which is
        // what lets this re-base be unconditional.
        const identity = submitted.players.map((_, index) => index);
        const settled = {
          ...submitted,
          seatOrder: identity,
          decks: clearedDecks(submitted.decks, wasSubmitted),
        };
        return {
          state: {
            ...previous.state,
            seatOrder: identity,
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
                  editsDisabled={saving}
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
            {errors.length > 0 && (
              <Alert color="warning">
                <ul className="mb-0">
                  {errors.map((error) => (
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
              <Button color="primary" onClick={save} disabled={!dirty || saving || errors.length > 0}>
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
