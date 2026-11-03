import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import Record, { PlayerList, Round, WinLossDraw } from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';
import classNames from 'classnames';

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
import TranscribePlayers from '../records/transcribe/TranscribePlayers';
import TranscribeRounds, { ResultsMode } from '../records/transcribe/TranscribeRounds';
import {
  applyPlayerEdit,
  areSeatsEditable,
  CardsUpdate,
  DeckBoard,
  isDirty,
  movePastes,
  seedTranscribeState,
  setDeckCards,
  toTranscribePayload,
  TranscribeDeck,
  TranscribePaste,
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

// A round with no matches in it is a round that has been added but not filled in, which is
// not yet a transcribed pairing. The results mode is seeded off this, and so is the note
// telling the user what final-records mode is hiding.
const anyPairings = (matches: Round[]): boolean => matches.some((round) => round.matches.length > 0);

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
  // The decklist each player's paste box is holding, plus the lines the last parse could not
  // resolve. Kept here rather than in the deck editor, which is unmounted the moment another
  // player's row is opened — the retained-errored-lines correction path is the whole reason
  // that text is still on screen, and collapsing a row must not throw it away.
  const [pastes, setPastes] = useState<{ [playerIndex: number]: TranscribePaste }>({});
  const [alerts, setAlerts] = useState<UncontrolledAlertProps[]>([]);
  const [saveError, setSaveError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [savedMessage, setSavedMessage] = useState<string>('');
  // Which kind of record is being written down: every pairing, or each player's final record.
  // It governs the whole page rather than one section, and it is presentation only — both
  // sides stay in TranscribeState and both are submitted whichever one is on screen. It opens
  // on whichever side the record already carries, so a standings-only record does not land on
  // an empty pairings list.
  const [resultsMode, setResultsMode] = useState<ResultsMode>(() =>
    Object.values(record.overrides ?? {}).some(Boolean) && !anyPairings(record.matches ?? []) ? 'records' : 'pairings',
  );

  const { state, seeded } = workspace;

  const updateState = useCallback((update: (previous: TranscribeState) => TranscribeState) => {
    setWorkspace((previous) => ({ ...previous, state: update(previous.state) }));
  }, []);

  // The draft answers for the whole record: the state module seeds every seat's editable
  // flag from exactly this, so a zero-player record cannot drift from its seats.
  const seatsEditable = areSeatsEditable(draft);

  // The live state as a Record, so the players section can use playerRecord and formatRecord
  // rather than reimplementing them against TranscribeState.
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
    (edited: PlayerList, originSeats: number[]) => {
      updateState((previous) => applyPlayerEdit(previous, edited, originSeats, seatsEditable));
      // A pending paste follows its player, exactly as applyPlayerEdit moves their deck.
      setPastes((previous) => movePastes(previous, originSeats));
    },
    [updateState, seatsEditable],
  );

  const setPasteText = useCallback(
    (playerIndex: number, text: string) =>
      setPastes((previous) => ({ ...previous, [playerIndex]: { text, errors: previous[playerIndex]?.errors ?? [] } })),
    [],
  );

  const setPasteErrors = useCallback(
    (playerIndex: number, errors: string[]) =>
      setPastes((previous) => ({ ...previous, [playerIndex]: { text: previous[playerIndex]?.text ?? '', errors } })),
    [],
  );

  // Unused until the record cells land on the player row: the final-records editor that used
  // to call this went out with the rounds-only reduction, and the row that replaces it is the
  // next task. Kept here because the override lives in this page's state either way.
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
        // for the next save. The players section holds every player edit shut for the length
        // of the request, so no other permutation can have been created in the meantime —
        // which is what lets this re-base be unconditional.
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
                  Results
                </Text>
                <Text sm className="text-text-secondary">
                  Are you transcribing every pairing, or only each player&apos;s final record?
                </Text>
                <Flexbox direction="row" gap="2" alignItems="center">
                  {[
                    { value: 'pairings' as const, label: 'Pairings' },
                    { value: 'records' as const, label: 'Final records only' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setResultsMode(option.value)}
                      className={classNames(
                        'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                        resultsMode === option.value ? 'border-link bg-bg-active' : 'border-border hover:bg-bg-active',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </Flexbox>
                {resultsMode === 'records' && anyPairings(state.matches) && (
                  <Text sm className="text-text-secondary">
                    Rounds of pairings are hidden in this mode. They are still recorded, and Save keeps them.
                  </Text>
                )}
              </Flexbox>

              <Flexbox direction="col" gap="2">
                <Text lg semibold>
                  Players
                </Text>
                <TranscribePlayers
                  cube={cube}
                  record={liveRecord}
                  draft={draft}
                  linkedUsers={players}
                  decks={state.decks}
                  setDeckBoard={setDeckBoard}
                  setTrophy={(trophy) => updateState((previous) => ({ ...previous, trophy }))}
                  seatsEditable={seatsEditable}
                  editsDisabled={saving}
                  onApplyPlayers={applyPlayers}
                  pastes={pastes}
                  setPasteText={setPasteText}
                  setPasteErrors={setPasteErrors}
                  setAlerts={setAlerts}
                />
              </Flexbox>

              {resultsMode === 'pairings' && (
                <Flexbox direction="col" gap="2">
                  <Text lg semibold>
                    Rounds
                  </Text>
                  <TranscribeRounds
                    players={state.players}
                    matches={state.matches}
                    setMatches={(matches) => updateState((previous) => ({ ...previous, matches }))}
                  />
                </Flexbox>
              )}

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
