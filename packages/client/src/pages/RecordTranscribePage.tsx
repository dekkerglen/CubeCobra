import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import Record, { PlayerList, Round, WinLossDraw } from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';
import { SectionBaselines, SectionKey } from '@utils/records/recordSections';
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
import { ConflictsAlert, SectionConflictMarker } from '../records/transcribe/SectionConflictNotice';
import TranscribePlayers from '../records/transcribe/TranscribePlayers';
import TranscribeRounds, { AddRoundButton, ResultsMode } from '../records/transcribe/TranscribeRounds';
import {
  applyPlayerEdit,
  areSeatsEditable,
  CardsUpdate,
  DeckBoard,
  fallbackRecord,
  isDirty,
  keepLocalSection,
  keepStoredSection,
  movePastes,
  reconcileAfterSave,
  SaveConflict,
  seedTranscribeState,
  setDeckCards,
  toTranscribePayload,
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
  // The same flag as a ref, because applyPlayers below is reached from handlers that await a
  // network lookup before applying: their closures captured `saving` as it was when the edit
  // was started, which is false even if a save opened while the lookup was outstanding.
  const savingRef = useRef<boolean>(false);
  const [savedMessage, setSavedMessage] = useState<string>('');
  // The sections the last save was refused on, with whatever the server currently holds for
  // each. Empty whenever nothing is contested — most of the time, and always before a first
  // save. Resolving one (see keepTheirs/keepMine below) removes it from here, which is also
  // what makes its marker disappear.
  const [conflicts, setConflicts] = useState<SaveConflict[]>([]);
  // Which kind of record is being written down: every pairing, or each player's final record.
  // It governs the whole page rather than one section, and it is presentation only — both
  // sides stay in TranscribeState and both are submitted whichever one is on screen. It opens
  // on whichever side the record already carries, so a standings-only record does not land on
  // an empty pairings list.
  const initialResultsMode: ResultsMode =
    Object.values(record.overrides ?? {}).some(Boolean) && !anyPairings(record.matches ?? []) ? 'records' : 'pairings';
  const [resultsMode, setResultsMode] = useState<ResultsMode>(initialResultsMode);
  // The mode the record was loaded in, or the mode the last save landed under. isDirty and
  // toTranscribePayload both compare an override's current value against the mode this
  // tracks, not the mode on screen right now — a record that opens in records mode with some
  // players lacking a stored override must not read as dirty before anything is touched, which
  // it would if the baseline were synthesized under whatever mode is live instead of the one
  // it was actually seeded under. It moves to the submitted mode on a successful save, exactly
  // like `seeded` itself.
  const [seededResultsMode, setSeededResultsMode] = useState<ResultsMode>(initialResultsMode);

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
    (edited: PlayerList, originSeats: number[]): boolean => {
      // The one chokepoint every player edit passes through, guarded here rather than only in
      // the handlers so that an edit cannot land mid-save by any route, including one a future
      // handler invents. When the save lands the seatOrder is re-based to identity against the
      // player list the server was sent; a permutation created against the seats it has
      // already moved would misattribute every deck on the next save. An add is worse still:
      // it would leave a longer player list than the seatOrder the re-base writes.
      //
      // Read from a ref rather than the `saving` state, because an edit that awaited an
      // @handle lookup applies with the closure it was started in — which captured `saving`
      // from before the request opened.
      if (savingRef.current) {
        return false;
      }
      updateState((previous) => applyPlayerEdit(previous, edited, originSeats, seatsEditable));
      // A pending paste follows its player, exactly as applyPlayerEdit moves their deck.
      setPastes((previous) => movePastes(previous, originSeats));
      return true;
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

  // The override lives in this page's state, so the player rows are handed the setter rather
  // than owning it: a rename re-keys it through applyPlayerEdit, and Save submits it whether
  // or not the mode that edits it is the one on screen.
  const setOverride = useCallback(
    (playerName: string, value: WinLossDraw | undefined) =>
      updateState((previous) => ({ ...previous, overrides: { ...previous.overrides, [playerName]: value } })),
    [updateState],
  );

  const errors = useMemo(() => validationErrors(state), [state]);

  // The mode decides what Save writes — records mode gives every player an explicit record
  // so nothing falls back to the matches. isDirty is given both the live mode, governing what
  // each override currently reads as, and the seeded mode, governing what its baseline reads
  // as — the same mode switch still dirties every override (both sides disagree the moment
  // the mode itself differs), but a record that has always been in records mode no longer
  // reads as dirty purely because some player has no stored override.
  const dirty = useMemo(
    () => isDirty(state, seeded, resultsMode === 'records', seededResultsMode === 'records'),
    [state, seeded, resultsMode, seededResultsMode],
  );

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
    const submittedMode = resultsMode;
    const payload = toTranscribePayload(state, seeded, submittedMode === 'records', seededResultsMode === 'records');
    setSaving(true);
    savingRef.current = true;
    setSaveError('');
    setSavedMessage('');

    try {
      const response = await csrfFetch(`/cube/records/enter/${record.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (json.success !== 'true') {
        // The page stays exactly as it is — the whole point of saving over JSON rather than
        // a redirecting form post is that a rejection costs the user none of their typing.
        setSaveError(json.message || 'Could not save this record.');
        return;
      }

      // A response naming which sections landed is read exactly as it says; one that
      // doesn't (an older or stubbed endpoint) is read the way a whole-record save always
      // behaved — everything submitted applied, nothing conflicted.
      const appliedKeys: SectionKey[] = Array.isArray(json.applied)
        ? json.applied
        : (Object.keys(payload.sections) as SectionKey[]);
      const conflictList: SaveConflict[] = Array.isArray(json.conflicts) ? json.conflicts : [];
      const responseRecord: SectionBaselines = json.record ?? fallbackRecord(payload.sections);

      setSeededResultsMode(submittedMode);
      setConflicts(conflictList);
      setWorkspace((previous) => {
        const { state: nextState, seeded: nextSeeded } = reconcileAfterSave(
          previous.state,
          previous.seeded,
          appliedKeys,
          responseRecord,
        );
        return { state: nextState, seeded: nextSeeded };
      });
      setSavedMessage(
        conflictList.length > 0
          ? 'Some sections could not be saved — someone else changed them. Resolve them below.'
          : 'Record saved.',
      );
    } catch {
      setSaveError('Could not save this record. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [csrfFetch, record.id, state, seeded, resultsMode, seededResultsMode]);

  // Resolving a conflict this way can immediately satisfy the "clean save" footer condition
  // (no conflicts left, nothing else dirty) — the message from the save that reported them
  // must not linger into that success alert and read as if a section is still contested.
  const clearConflict = useCallback((section: SectionKey) => {
    setConflicts((previous) => {
      const next = previous.filter((item) => item.section !== section);
      if (next.length === 0) {
        setSavedMessage('');
      }
      return next;
    });
  }, []);

  // "Keep theirs": the conflicted section's local edit is discarded outright, both sides
  // taking the server's current value, so it reads clean immediately.
  const keepTheirs = useCallback(
    (conflict: SaveConflict) => {
      setWorkspace((previous) => {
        const { state: nextState, seeded: nextSeeded } = keepStoredSection(previous.state, previous.seeded, conflict);
        return { state: nextState, seeded: nextSeeded };
      });
      clearConflict(conflict.section);
    },
    [clearConflict],
  );

  // "Keep mine": only the baseline moves — the local edit survives and stays dirty, so the
  // next Save resubmits it against a baseline that now matches storage, overwriting it.
  const keepMine = useCallback(
    (conflict: SaveConflict) => {
      setWorkspace((previous) => ({
        ...previous,
        seeded: keepLocalSection(previous.state, previous.seeded, conflict),
      }));
      clearConflict(conflict.section);
    },
    [clearConflict],
  );

  const conflictFor = useCallback(
    (key: SectionKey) => conflicts.find((conflict) => conflict.section === key),
    [conflicts],
  );

  const conflictMarker = (conflict: SaveConflict | undefined) =>
    conflict && (
      <SectionConflictMarker
        conflict={conflict}
        players={state.players}
        onKeepTheirs={() => keepTheirs(conflict)}
        onKeepMine={() => keepMine(conflict)}
        disabled={saving}
      />
    );

  // Everyone the Players card is responsible for: the list itself, the trophy (per-player
  // data, but one section with no row of its own to sit on), and every per-player override or
  // deck — each gets its own marker so resolving one never touches the others.
  const playerSectionConflicts = useMemo(
    () =>
      conflicts.filter(
        (conflict) =>
          conflict.section === 'players' ||
          conflict.section === 'trophy' ||
          conflict.section.startsWith('overrides:') ||
          conflict.section.startsWith('decks:'),
      ),
    [conflicts],
  );

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

              <ConflictsAlert conflicts={conflicts} players={state.players} />

              {/* One card per section. The headings alone said where a section began but
                  never where it ended, so Players ran into Rounds with nothing between. */}
              <Card>
                <CardHeader>
                  <Text lg semibold>
                    Event details
                  </Text>
                </CardHeader>
                <CardBody>
                  <Flexbox direction="col" gap="2">
                    {conflictMarker(conflictFor('overview'))}
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
                  </Flexbox>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <Text lg semibold>
                    Results
                  </Text>
                </CardHeader>
                <CardBody>
                  <Flexbox direction="col" gap="2">
                    {/* The Rounds card below only exists in "Pairings" mode, but a `rounds`
                        conflict can still be outstanding while viewing "Final records only" —
                        this is the only resolution control for it, so it must stay reachable
                        in both modes rather than living inside that conditional card. */}
                    {conflictMarker(conflictFor('rounds'))}
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
                          // The selected mode is otherwise conveyed by colour alone, and this
                          // toggle governs whether half the page renders.
                          aria-pressed={resultsMode === option.value}
                          className={classNames(
                            'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                            resultsMode === option.value
                              ? 'border-link bg-bg-active'
                              : 'border-border hover:bg-bg-active',
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </Flexbox>
                    {resultsMode === 'records' && anyPairings(state.matches) && (
                      <Text sm className="text-text-secondary">
                        Rounds of pairings are hidden in this mode, and ignored: each player&apos;s record is whatever
                        you type below. They are still recorded, and Save keeps them.
                      </Text>
                    )}
                  </Flexbox>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <Text lg semibold>
                    Players
                  </Text>
                </CardHeader>
                <CardBody>
                  <Flexbox direction="col" gap="2">
                    {playerSectionConflicts.map((conflict) => (
                      <React.Fragment key={conflict.section}>{conflictMarker(conflict)}</React.Fragment>
                    ))}
                    <TranscribePlayers
                      cube={cube}
                      record={liveRecord}
                      draft={draft}
                      linkedUsers={players}
                      decks={state.decks}
                      setDeckBoard={setDeckBoard}
                      setTrophy={(trophy) => updateState((previous) => ({ ...previous, trophy }))}
                      resultsMode={resultsMode}
                      overrides={state.overrides}
                      setOverride={setOverride}
                      seatsEditable={seatsEditable}
                      editsDisabled={saving}
                      onApplyPlayers={applyPlayers}
                      pastes={pastes}
                      setPasteText={setPasteText}
                      setPasteErrors={setPasteErrors}
                      setAlerts={setAlerts}
                    />
                  </Flexbox>
                </CardBody>
              </Card>

              {resultsMode === 'pairings' && (
                <Card>
                  <CardHeader>
                    <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap">
                      <Text lg semibold>
                        Rounds
                      </Text>
                      <AddRoundButton
                        matches={state.matches}
                        setMatches={(matches) => updateState((previous) => ({ ...previous, matches }))}
                      />
                    </Flexbox>
                  </CardHeader>
                  <CardBody>
                    <Flexbox direction="col" gap="2">
                      <TranscribeRounds
                        players={state.players}
                        matches={state.matches}
                        setMatches={(matches) => updateState((previous) => ({ ...previous, matches }))}
                      />
                    </Flexbox>
                  </CardBody>
                </Card>
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
            {/* Distinguishes a clean save from one that landed only partly — the latter
                stays visible regardless of `dirty`, since the sections it refused are, by
                definition, still dirty until resolved above. */}
            {!saveError && savedMessage && conflicts.length > 0 && (
              <Alert color="warning">
                <Text sm>{savedMessage}</Text>
              </Alert>
            )}
            {!saveError && savedMessage && conflicts.length === 0 && !dirty && (
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
