import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import {
  SYNERGY_CONNECT_MAX_MISTAKES,
  SynergyConnectBoard,
  SynergyConnectGroup,
  SynergyConnectSubmission,
  SynergyConnectUserStats,
} from '@utils/datatypes/SynergyConnect';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import SynergyConnectHelpModal from 'components/synergyconnect/SynergyConnectHelpModal';
import SynergyConnectResults from 'components/synergyconnect/SynergyConnectResults';
import SynergyConnectTile from 'components/synergyconnect/SynergyConnectTile';
import useFlipGrid from 'components/synergyconnect/useFlipGrid';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import useLocalStorage from 'hooks/useLocalStorage';
import MainLayout from 'layouts/MainLayout';

interface SolvedEntry {
  groupIndex: number;
  group: SynergyConnectGroup;
}

interface SynergyConnectPageProps {
  board: SynergyConnectBoard | null;
  submission: SynergyConnectSubmission | null;
  userStats: SynergyConnectUserStats | null;
  // Every group, sent only once the game is over.
  revealed: SynergyConnectGroup[] | null;
  isArchive: boolean;
}

// Anonymous progress lives in localStorage; logged-in progress comes from the
// server-provided submission.
interface AnonState {
  solved: SolvedEntry[];
  guesses: number[][];
  mistakes: number;
}

const formatDate = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const SynergyConnectPage: React.FC<SynergyConnectPageProps> = ({
  board,
  submission,
  userStats,
  revealed,
  isArchive,
}) => {
  const user = useContext(UserContext);
  const { csrfFetch } = useContext(CSRFContext);

  const [anonState, setAnonState] = useLocalStorage<AnonState>(`synergyconnect-${board?.date ?? 'none'}`, {
    solved: [],
    guesses: [],
    mistakes: 0,
  });

  // The server hands back solved groups in solve order, and the submission
  // carries the matching indices — zip them so each row keeps its colour.
  const serverSolved: SolvedEntry[] = useMemo(
    () =>
      (board?.solvedGroups ?? []).map((group, i) => ({
        groupIndex: submission?.solvedGroups?.[i] ?? i,
        group,
      })),
    [board, submission],
  );

  const [solved, setSolved] = useState<SolvedEntry[]>(() => (user ? serverSolved : anonState.solved));
  const [guesses, setGuesses] = useState<number[][]>(() => (user ? (submission?.guesses ?? []) : anonState.guesses));
  const [mistakes, setMistakes] = useState<number>(() => (user ? (submission?.mistakes ?? 0) : anonState.mistakes));
  const [stats, setStats] = useState<SynergyConnectUserStats | null>(userStats);
  const [allGroups, setAllGroups] = useState<SynergyConnectGroup[] | null>(revealed);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Cards currently shaking from a wrong guess.
  const [shake, setShake] = useState<string[]>([]);
  // Show the rules automatically the first time someone plays.
  const [seenHelp, setSeenHelp] = useLocalStorage<boolean>('synergyconnect-seen-help', false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Order of the cards that haven't been grouped yet. Solved groups are pinned
  // ahead of these, so finding one lifts its four cards into the next row and
  // everything below glides down.
  const [unsolvedOrder, setUnsolvedOrder] = useState<string[]>(() => (board?.cards ?? []).map((card) => card.oracleId));

  const cardsById = useMemo(() => new Map((board?.cards ?? []).map((card) => [card.oracleId, card])), [board]);

  // Groups shown on the board: the ones found, plus — once the game is over —
  // the ones that were never found, so the answers live on the board itself
  // rather than in a duplicate list below it.
  const revealedEntries = useMemo(() => {
    if (!allGroups) {
      return solved;
    }
    const solvedIndices = new Set(solved.map((entry) => entry.groupIndex));
    return [
      ...solved,
      ...allGroups
        .map((group, groupIndex) => ({ group, groupIndex }))
        .filter((entry) => !solvedIndices.has(entry.groupIndex)),
    ];
  }, [allGroups, solved]);

  // Group index per card, for groups currently revealed.
  const solvedGroupOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of revealedEntries) {
      for (const card of entry.group.cards) {
        map.set(card.oracleId, entry.groupIndex);
      }
    }
    return map;
  }, [revealedEntries]);

  // Revealed groups first (in the order they were found), then everything still in play.
  const displayOrder = useMemo(() => {
    const solvedIds = revealedEntries.flatMap((entry) => entry.group.cards.map((card) => card.oracleId));
    const solvedSet = new Set(solvedIds);
    return [...solvedIds, ...unsolvedOrder.filter((id) => !solvedSet.has(id))];
  }, [revealedEntries, unsolvedOrder]);

  const registerTile = useFlipGrid(displayOrder);

  const shuffleBoard = useCallback(() => {
    setUnsolvedOrder((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j]!, next[i]!];
      }
      return next;
    });
  }, []);

  const won = solved.length >= 4;
  const lost = mistakes >= SYNERGY_CONNECT_MAX_MISTAKES;
  const gameOver = won || lost;

  // First-time players get the rules up front.
  useEffect(() => {
    if (board && !seenHelp) {
      setHelpOpen(true);
      setSeenHelp(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  const toggleCard = useCallback(
    (oracleId: string) => {
      if (gameOver || submitting) {
        return;
      }
      setMessage(null);
      setSelected((prev) => {
        if (prev.includes(oracleId)) {
          return prev.filter((id) => id !== oracleId);
        }
        return prev.length >= 4 ? prev : [...prev, oracleId];
      });
    },
    [gameOver, submitting],
  );

  const submitGuess = useCallback(async () => {
    if (!board || selected.length !== 4 || submitting) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const response = await csrfFetch('/tool/api/synergyconnect/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: board.date, cards: selected }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.error ?? 'Error submitting guess');
        return;
      }

      const nextGuesses = [...guesses, data.guessGroups as number[]];
      let nextSolved = solved;
      let nextMistakes = mistakes;

      if (!data.correct) {
        // Shake the guess before the mistake lands.
        setShake(selected);
        await new Promise((resolve) => setTimeout(resolve, 500));
        setShake([]);
      }

      if (data.correct) {
        nextSolved = [...solved, { groupIndex: data.groupIndex as number, group: data.group as SynergyConnectGroup }];
        setSolved(nextSolved);
        setSelected([]);
      } else {
        nextMistakes = mistakes + 1;
        setMistakes(nextMistakes);
        setMessage(data.oneAway ? 'One away…' : 'Not a group.');
      }

      setGuesses(nextGuesses);
      if (data.stats) {
        setStats(data.stats);
      }
      if (data.revealed) {
        setAllGroups(data.revealed as SynergyConnectGroup[]);
      }

      if (!user) {
        setAnonState({ solved: nextSolved, guesses: nextGuesses, mistakes: nextMistakes });
      }
    } catch {
      setMessage('Error submitting guess');
    } finally {
      setSubmitting(false);
    }
  }, [board, selected, submitting, csrfFetch, guesses, solved, mistakes, user, setAnonState]);

  return (
    // useContainer={false}: this page owns its own layout so nothing pads the
    // board inward — on phones the grid runs to the screen edges, on desktop it
    // sits in a centred panel.
    <MainLayout useContainer={false}>
      <DynamicFlash />
      <div className="mx-auto w-full max-w-3xl sm:my-1 sm:px-2">
        <div className="bg-bg-accent/80 sm:rounded-md sm:border sm:border-border sm:shadow">
          <div className="border-b border-border px-3 py-2">
            <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
              <Flexbox direction="row" alignItems="center" gap="2" wrap="wrap">
                <Text lg semibold>
                  Synergy Connect
                </Text>
                {board && (
                  <Text md className="text-text-secondary">
                    {formatDate(board.date)}
                    {isArchive ? ' · archive puzzle' : ''}
                  </Text>
                )}
              </Flexbox>
              <Flexbox direction="row" gap="3" alignItems="center">
                <Link href="#" onClick={() => setHelpOpen(true)} aria-label="How to play">
                  How to play
                </Link>
                {isArchive && <Link href="/tool/synergyconnect">Today's Puzzle</Link>}
                <Link href="/tool/synergyconnect/archive">Archive</Link>
              </Flexbox>
            </Flexbox>
          </div>
          <div className="py-2">
            {!board ? (
              <Text className="px-3 text-center text-text-secondary">
                No puzzle is available yet. Check back soon — a new Synergy Connect is posted every day!
              </Text>
            ) : (
              <Flexbox direction="col" gap="1">
                <Flexbox direction="row" justify="center" alignItems="center" gap="2" wrap="wrap" className="px-3">
                  <Text xs className="text-center text-text-secondary">
                    Today's groupings are all{' '}
                    <span className="font-semibold">legendary creatures {board.theme.description}</span>.
                    {!user && (
                      <>
                        {' '}
                        <Link href="/user/login">Log in</Link> to keep a streak.
                      </>
                    )}
                  </Text>
                  {/* Lives left, as dots — compact enough to sit inline. */}
                  <span
                    className="flex items-center gap-1"
                    aria-label={`${mistakes} of ${SYNERGY_CONNECT_MAX_MISTAKES} mistakes used`}
                  >
                    {Array.from({ length: SYNERGY_CONNECT_MAX_MISTAKES }, (_, i) => (
                      <span
                        key={i}
                        className={classNames('h-2 w-2 rounded-full', {
                          'bg-text-secondary': i < SYNERGY_CONNECT_MAX_MISTAKES - mistakes,
                          'bg-text-secondary/25': i >= SYNERGY_CONNECT_MAX_MISTAKES - mistakes,
                        })}
                      />
                    ))}
                  </span>
                </Flexbox>

                {/* Height-capped so all four rows fit without scrolling; hover a
                  card to read it at full size. */}
                <div
                  className="relative mx-auto grid w-full grid-cols-4 gap-0.5 sm:gap-1.5"
                  style={{ maxWidth: 'min(100%, calc((100vh - 12.5rem) / 1.4 + 1.5rem))' }}
                >
                  {displayOrder.map((oracleId, index) => {
                    const card = cardsById.get(oracleId);
                    if (!card) {
                      return null;
                    }
                    const groupIndex = solvedGroupOf.get(oracleId) ?? null;
                    // Label the row on its first card.
                    const showLabel = groupIndex !== null && index % 4 === 0;
                    const entry = showLabel ? revealedEntries.find((s) => s.groupIndex === groupIndex) : undefined;

                    return (
                      <div key={oracleId} ref={registerTile(oracleId)} className="relative">
                        <SynergyConnectTile
                          card={card}
                          selected={selected.includes(oracleId)}
                          solvedGroupIndex={groupIndex}
                          disabled={gameOver || submitting}
                          shake={shake.includes(oracleId)}
                          onClick={() => toggleCard(oracleId)}
                        />
                        {entry && (
                          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-[calc(400%+1.5rem)] items-center justify-center px-2">
                            <span className="synergy-solve-in rounded-md bg-black/70 px-3 py-1 text-center text-sm font-bold text-white sm:text-lg">
                              {entry.group.commander.name}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {message && (
                  <Text sm className="text-center font-semibold text-text-secondary">
                    {message}
                  </Text>
                )}

                {!gameOver && (
                  <Flexbox direction="row" justify="center" gap="2" wrap="wrap" className="px-3">
                    <Button color="secondary" onClick={shuffleBoard} disabled={submitting}>
                      Shuffle
                    </Button>
                    <Button color="secondary" onClick={() => setSelected([])} disabled={submitting || !selected.length}>
                      Deselect all
                    </Button>
                    <Button color="primary" onClick={submitGuess} disabled={submitting || selected.length !== 4}>
                      {submitting ? 'Checking…' : 'Submit'}
                    </Button>
                  </Flexbox>
                )}

                {gameOver && (
                  <div className="px-3">
                    <SynergyConnectResults
                      date={board.date}
                      won={won}
                      guesses={guesses}
                      mistakes={mistakes}
                      stats={stats}
                      isArchive={isArchive}
                      canReveal={!!user || won}
                    />
                  </div>
                )}
              </Flexbox>
            )}
          </div>
        </div>
      </div>

      <SynergyConnectHelpModal isOpen={helpOpen} setOpen={setHelpOpen} />
    </MainLayout>
  );
};

export default RenderToRoot(SynergyConnectPage);
