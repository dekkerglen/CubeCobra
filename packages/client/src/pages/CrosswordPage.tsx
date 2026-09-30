import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { CrosswordAnswer, CrosswordBoard, CrosswordSubmission, CrosswordUserStats } from '@utils/datatypes/Crossword';

import Button from 'components/base/Button';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Text from 'components/base/Text';
import { CrosswordClueBar, CrosswordClueList } from 'components/crossword/CrosswordClues';
import CrosswordGrid from 'components/crossword/CrosswordGrid';
import CrosswordResults from 'components/crossword/CrosswordResults';
import { emptyLetters, formatDuration, lettersFitShape, slotCells } from 'components/crossword/crosswordShape';
import { useCrosswordSolver } from 'components/crossword/useCrosswordSolver';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import SideBanner from 'components/SideBanner';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import useLocalStorage from 'hooks/useLocalStorage';
import MainLayout from 'layouts/MainLayout';

interface CrosswordPageProps {
  /** The playable board: geometry, numbering and clues. Never the letters. */
  board: CrosswordBoard | null;
  submission: CrosswordSubmission | null;
  userStats: CrosswordUserStats | null;
  /** Server-measured time on the clock when the page was rendered. */
  elapsedMs: number | null;
  /** Every entry, sent only once this player has solved it. */
  answers: CrosswordAnswer[] | null;
  isArchive: boolean;
}

const formatDate = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * The grid's side is capped by the viewport height as well as by the column it
 * sits in, so a desktop solver never has to scroll to see the whole puzzle. The
 * reserve covers the navbar, the panel header, the clue bar and the buttons.
 */
const GRID_MAX_WIDTH = 'min(100%, 36rem, calc(100vh - 13rem))';

const CrosswordPage: React.FC<CrosswordPageProps> = ({
  board,
  submission,
  userStats,
  elapsedMs,
  answers: initialAnswers,
  isArchive,
}) => {
  const user = useContext(UserContext);
  const { csrfFetch } = useContext(CSRFContext);

  const [solved, setSolved] = useState(submission?.solved ?? false);
  const [checks, setChecks] = useState(submission?.checks ?? 0);
  const [reveals, setReveals] = useState(submission?.reveals ?? 0);
  const [completionTimeMs, setCompletionTimeMs] = useState<number | null>(submission?.completionTimeMs ?? null);
  const [stats, setStats] = useState<CrosswordUserStats | null>(userStats);
  const [answers, setAnswers] = useState<CrosswordAnswer[] | null>(initialAnswers);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // In-progress letters live in the browser: they are what the solver typed, not
  // an answer, and keeping them here means no request per keystroke. The server
  // keeps the clock and the result.
  const [storedLetters, setStoredLetters] = useLocalStorage<string[][] | null>(
    `crossword-${board?.date ?? 'none'}`,
    null,
  );

  /**
   * A solved puzzle rendered from its answer key. Covers the case the stored
   * letters can't: solving on one device and reloading on another.
   */
  const solvedLetters = useMemo(() => {
    if (!board || !initialAnswers) {
      return null;
    }
    const grid = emptyLetters(board);
    for (const answer of initialAnswers) {
      const slot = board.slots.find((candidate) => candidate.id === answer.id);
      if (!slot) {
        continue;
      }
      slotCells(slot).forEach((cell, index) => {
        grid[cell.row]![cell.col] = answer.text[index] ?? '';
      });
    }
    return grid;
  }, [board, initialAnswers]);

  const solver = useCrosswordSolver({
    shape: board,
    initialLetters: solvedLetters ?? (board && lettersFitShape(storedLetters, board) ? storedLetters : null),
    locked: solved,
  });

  // Mirror the run into localStorage so a reload resumes it.
  useEffect(() => {
    if (board && solver.filled.length > 0) {
      setStoredLetters(solver.filled);
    }
    // setStoredLetters is re-created every render; depending on it would write on
    // every render rather than on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, solver.filled]);

  // The clock. Anchored to a start derived from the server's elapsed time, so the
  // display counts real seconds rather than accumulating interval drift.
  const startRef = useRef(Date.now() - (elapsedMs ?? 0));
  const [elapsed, setElapsed] = useState(elapsedMs ?? 0);
  useEffect(() => {
    if (solved || !board) {
      return;
    }
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(id);
  }, [board, solved]);

  const applyResult = useCallback((data: any) => {
    if (data.submission) {
      setChecks(data.submission.checks);
      setReveals(data.submission.reveals);
      setCompletionTimeMs(data.submission.completionTimeMs ?? null);
      setSolved(data.submission.solved);
    } else if (data.solved) {
      setSolved(true);
    }
    if (data.stats) {
      setStats(data.stats);
    }
    if (data.answers) {
      setAnswers(data.answers as CrosswordAnswer[]);
    }
  }, []);

  /** Asks the server whether the grid is the answer. Free: no check is spent. */
  const submitGrid = useCallback(async () => {
    if (!board) {
      return;
    }
    try {
      const response = await csrfFetch('/tool/api/crossword/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: board.date, letters: solver.filled }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        return;
      }
      applyResult(data);
      if (!data.solved) {
        setMessage('Not quite — something in the grid is wrong.');
      }
    } catch {
      // A failed auto-submit is silent: the solver didn't ask for it.
    }
  }, [applyResult, board, csrfFetch, solver.filled]);

  // Auto-submit the moment the grid fills up, once per distinct grid, so
  // finishing costs nothing.
  const lastSubmitted = useRef<string | null>(null);
  const signature = useMemo(() => solver.filled.map((row) => row.join('')).join('|'), [solver.filled]);
  useEffect(() => {
    if (!board || solved || !solver.isFull || lastSubmitted.current === signature) {
      return;
    }
    lastSubmitted.current = signature;
    void submitGrid();
    // submitGrid closes over the same letters `signature` is derived from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, signature, solved, solver.isFull]);

  /** Marks the wrong letters. Costs a check, which the result shows. */
  const check = useCallback(async () => {
    if (!board || busy) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await csrfFetch('/tool/api/crossword/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: board.date, letters: solver.filled }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage(data.error ?? 'Error checking the grid');
        return;
      }

      solver.markWrong(data.wrong as string[]);
      applyResult(data);
      if (!data.solved) {
        const wrong = (data.wrong as string[]).length;
        setMessage(`${wrong} wrong letter${wrong === 1 ? '' : 's'}, ${data.blank} still blank.`);
      }
    } catch {
      setMessage('Error checking the grid');
    } finally {
      setBusy(false);
    }
  }, [applyResult, board, busy, csrfFetch, solver]);

  /** Fills in the active word. Costs a reveal, which the result shows. */
  const revealWord = useCallback(async () => {
    if (!board || busy || !solver.activeSlot) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await csrfFetch('/tool/api/crossword/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: board.date, slotId: solver.activeSlot.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage(data.error ?? 'Error revealing the word');
        return;
      }

      solver.writeCells(data.revealed.cells, true);
      applyResult(data);
    } catch {
      setMessage('Error revealing the word');
    } finally {
      setBusy(false);
    }
  }, [applyResult, board, busy, csrfFetch, solver]);

  const clear = useCallback(() => {
    setMessage(null);
    lastSubmitted.current = null;
    solver.clearAll();
  }, [solver]);

  /** Clues whose answer is completely filled in, so the lists can grey them out. */
  const completedSlotIds = useMemo(() => {
    const done = new Set<string>();
    for (const slot of board?.slots ?? []) {
      if (slotCells(slot).every(({ row, col }) => (solver.filled[row]?.[col] ?? '') !== '')) {
        done.add(slot.id);
      }
    }
    return done;
  }, [board, solver.filled]);

  /**
   * The time to show. A logged-in solve has a server-measured one; an anonymous
   * solve has only the clock that has been ticking on screen, which is worth
   * showing as long as the result panel is clear that it wasn't recorded.
   */
  const finalTime = solved ? (completionTimeMs ?? elapsed) : null;
  const shownTime = finalTime ?? elapsed;

  return (
    // useContainer={false}: this page owns its own layout so nothing pads the grid
    // inward — on phones it runs to the screen edges, on desktop it sits in a
    // centered panel beside the clues. The ad rails MainLayout would have supplied
    // are reproduced here so they only kick in at widths where they can't squeeze
    // the grid.
    <MainLayout useContainer={false}>
      <Container xxxl>
        <Flexbox direction="row" gap="4" className="flex-grow max-w-full">
          <ResponsiveDiv xxl className="pl-2 py-2 min-w-fit">
            <SideBanner placementId="left-rail" />
          </ResponsiveDiv>
          <div className="flex-grow min-w-0 max-w-full">
            <DynamicFlash />
            <div className="mx-auto w-full max-w-5xl sm:my-1 sm:px-2">
              <div className="bg-bg-accent/80 sm:rounded-md sm:border sm:border-border sm:shadow">
                <div className="border-b border-border px-3 py-2">
                  <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
                    <Flexbox direction="row" alignItems="center" gap="2" wrap="wrap">
                      <Text lg semibold>
                        Crossword
                      </Text>
                      {board && (
                        <Text md className="text-text-secondary">
                          {formatDate(board.date)}
                          {isArchive ? ' · archive puzzle' : ''}
                        </Text>
                      )}
                      {board && (
                        <Text md semibold className="font-mono tabular-nums" aria-label="Time elapsed">
                          {formatDuration(shownTime)}
                        </Text>
                      )}
                    </Flexbox>
                    <Flexbox direction="row" gap="3" alignItems="center">
                      {isArchive && <Link href="/tool/crossword">Today's Puzzle</Link>}
                      <Link href="/tool/crossword/archive">Archive</Link>
                    </Flexbox>
                  </Flexbox>
                </div>

                <div className="py-2">
                  {!board ? (
                    <Text className="px-3 text-center text-text-secondary">
                      No puzzle is available yet. Check back soon — a new crossword is posted every day!
                    </Text>
                  ) : (
                    <Flexbox direction="col" gap="2">
                      {!user && (
                        <Text xs className="px-3 text-center text-text-secondary">
                          <Link href="/user/login">Log in</Link> to have your time recorded and keep a streak.
                        </Text>
                      )}

                      {/* lg and up puts the clue lists beside the grid; below that
                          they stack, so the grid never shrinks to share a row. */}
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:px-3">
                        <div className="flex w-full min-w-0 flex-col gap-1 lg:shrink-0" style={{ maxWidth: '36rem' }}>
                          <CrosswordGrid shape={board} solver={solver} maxWidth={GRID_MAX_WIDTH} />

                          {/* Under the grid, not over it: that is the strip a phone
                              leaves above the keyboard, and the pair of them is what
                              the soft-keyboard fit scrolls into view. */}
                          <CrosswordClueBar solver={solver} />

                          {message && (
                            <Text sm className="px-1 text-center text-text-secondary">
                              {message}
                            </Text>
                          )}

                          {!solved && (
                            <Flexbox direction="row" justify="center" gap="2" wrap="wrap" className="px-3 pt-1">
                              <Button color="primary" onClick={check} disabled={busy}>
                                Check
                              </Button>
                              <Button
                                color="secondary"
                                onClick={revealWord}
                                disabled={busy || !solver.activeSlot || !user}
                                // Revealing needs a run to charge the reveal to;
                                // anonymous play isn't recorded, so there isn't one.
                                title={user ? undefined : 'Log in to reveal a word'}
                              >
                                Reveal word
                              </Button>
                              <Button color="danger" outline onClick={clear} disabled={busy}>
                                Clear
                              </Button>
                            </Flexbox>
                          )}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-4 px-3 sm:flex-row lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto lg:px-0">
                          <CrosswordClueList
                            slots={solver.acrossSlots}
                            heading="Across"
                            activeSlotId={solver.activeSlot?.id}
                            onSelect={solver.selectSlot}
                            completedSlotIds={completedSlotIds}
                          />
                          <CrosswordClueList
                            slots={solver.downSlots}
                            heading="Down"
                            activeSlotId={solver.activeSlot?.id}
                            onSelect={solver.selectSlot}
                            completedSlotIds={completedSlotIds}
                          />
                        </div>
                      </div>

                      {solved && (
                        <div className="px-3">
                          <CrosswordResults
                            date={board.date}
                            completionTimeMs={finalTime}
                            checks={checks}
                            reveals={reveals}
                            stats={stats}
                            isArchive={isArchive}
                            answers={answers}
                            isAnonymous={!user}
                          />
                        </div>
                      )}
                    </Flexbox>
                  )}
                </div>
              </div>
            </div>
          </div>
          <ResponsiveDiv lg className="pr-2 py-2 min-w-fit">
            <SideBanner placementId="right-rail" />
          </ResponsiveDiv>
        </Flexbox>
      </Container>
    </MainLayout>
  );
};

export default RenderToRoot(CrosswordPage);
