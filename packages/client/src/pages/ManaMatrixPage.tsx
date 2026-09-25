import React, { useCallback, useContext, useState } from 'react';

import {
  ManaMatrixCategory,
  ManaMatrixCellPopularity,
  ManaMatrixPuzzle,
  ManaMatrixSubmission,
  ManaMatrixUserStats,
} from '@utils/datatypes/ManaMatrix';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { Modal, ModalBody, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import ManaMatrixCellModal from 'components/manamatrix/ManaMatrixCellModal';
import ManaMatrixGrid from 'components/manamatrix/ManaMatrixGrid';
import ManaMatrixResults from 'components/manamatrix/ManaMatrixResults';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import useLocalStorage from 'hooks/useLocalStorage';
import MainLayout from 'layouts/MainLayout';

interface ManaMatrixPageProps {
  puzzle: ManaMatrixPuzzle | null;
  submission: ManaMatrixSubmission | null;
  userStats: ManaMatrixUserStats | null;
  popularity: (ManaMatrixCellPopularity | null)[][] | null;
  isArchive: boolean;
}

// Per cell: true = solved, false = checked and wrong, null = not yet checked
// (empty, or edited since the last check). Red only ever means "this exact
// answer was checked and is wrong".
type CellState = boolean | null;

// Anonymous progress lives in localStorage (namespaced per puzzle date);
// logged-in progress comes from the server-provided submission.
interface AnonState {
  values: string[][];
  correct: CellState[][] | null;
  attempts: number;
  popularity: (ManaMatrixCellPopularity | null)[][] | null;
}

const emptyValues = (): string[][] => Array.from({ length: 3 }, () => ['', '', '']);

const answersToValues = (answers: (string | null)[][] | undefined): string[][] =>
  answers ? answers.map((row) => row.map((value) => value ?? '')) : emptyValues();

// Maps a checked grid onto display states: a false only sticks to cells that
// actually hold an answer — empty cells read as "unanswered", not "wrong".
const toCellStates = (checked: (boolean | null)[][] | null | undefined, values: string[][]): CellState[][] | null =>
  checked
    ? checked.map((row, r) =>
        row.map((cell, c) => (cell === true ? true : (values[r]?.[c] ?? '').trim() ? cell : null)),
      )
    : null;

const formatDate = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const ManaMatrixPage: React.FC<ManaMatrixPageProps> = ({
  puzzle,
  submission,
  userStats,
  popularity: initialPopularity,
  isArchive,
}) => {
  const user = useContext(UserContext);
  const { csrfFetch } = useContext(CSRFContext);

  const [anonState, setAnonState] = useLocalStorage<AnonState>(`manamatrix-${puzzle?.date ?? 'none'}`, {
    values: emptyValues(),
    correct: null,
    attempts: 0,
    popularity: null,
  });

  const [values, setValues] = useState<string[][]>(() =>
    user ? answersToValues(submission?.answers) : anonState.values,
  );
  const [correct, setCorrect] = useState<CellState[][] | null>(() =>
    user
      ? submission && submission.attempts > 0
        ? toCellStates(submission.correct, answersToValues(submission.answers))
        : null
      : toCellStates(anonState.correct, anonState.values),
  );
  const [attempts, setAttempts] = useState<number>(() => (user ? (submission?.attempts ?? 0) : anonState.attempts));
  const [popularity, setPopularity] = useState<(ManaMatrixCellPopularity | null)[][] | null>(() =>
    user ? initialPopularity : anonState.popularity,
  );
  const [stats, setStats] = useState<ManaMatrixUserStats | null>(userStats);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalCell, setModalCell] = useState<{ row: number; col: number } | null>(null);
  // On mobile the grid labels only show filter syntax; tapping one opens the
  // human-readable translation here.
  const [categoryModal, setCategoryModal] = useState<ManaMatrixCategory | null>(null);

  const setCellValue = useCallback(
    (row: number, col: number, value: string) => {
      const next = values.map((valueRow) => [...valueRow]);
      next[row]![col] = value;

      // Editing a cell returns it to "unchecked" — its old red X no longer
      // applies to the new answer.
      let nextCorrect = correct;
      if (correct?.[row]?.[col] === false) {
        nextCorrect = correct.map((correctRow) => [...correctRow]);
        nextCorrect[row]![col] = null;
      }

      setValues(next);
      setCorrect(nextCorrect);
      if (!user) {
        setAnonState({ ...anonState, values: next, correct: nextCorrect });
      }
    },
    [values, correct, user, anonState, setAnonState],
  );

  const submit = useCallback(async () => {
    if (!puzzle || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await csrfFetch('/tool/api/manamatrix/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: puzzle.date, answers: values }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error ?? 'Error submitting answers');
        return;
      }

      // The server echoes answers back with canonical card names for solved cells.
      const nextValues = data.answers ? answersToValues(data.answers) : values;
      const nextAttempts: number = data.attempts ?? attempts + 1;

      // Logged-in merging ("solved cells stay solved") happens server-side; for
      // anonymous players mirror it here, so a card that stops matching after a
      // catalog update can't flip a solved cell back to red.
      let nextCorrect: CellState[][] = toCellStates(data.correct, nextValues)!;
      let nextPopularity: (ManaMatrixCellPopularity | null)[][] | null = data.popularity ?? null;
      if (!user && correct) {
        nextCorrect = nextCorrect.map((row, r) => row.map((cell, c) => (correct[r]?.[c] === true ? true : cell)));
        if (popularity) {
          const base = nextPopularity ?? Array.from({ length: 3 }, () => [null, null, null]);
          nextPopularity = base.map((row, r) => row.map((cell, c) => cell ?? popularity[r]?.[c] ?? null));
        }
      }

      setValues(nextValues);
      setCorrect(nextCorrect);
      setAttempts(nextAttempts);
      setPopularity(nextPopularity);
      if (data.stats) {
        setStats(data.stats);
      }
      if (!user) {
        setAnonState({
          values: nextValues,
          correct: nextCorrect,
          attempts: nextAttempts,
          popularity: nextPopularity,
        });
      }
    } catch {
      setError('Error submitting answers');
    } finally {
      setSubmitting(false);
    }
  }, [puzzle, submitting, csrfFetch, values, attempts, correct, popularity, user, setAnonState]);

  const solvedCount = correct ? correct.flat().filter((cell) => cell === true).length : 0;
  const filledCount = values.flat().filter((value) => value.trim().length > 0).length;
  const isComplete = solvedCount === 9;

  return (
    <MainLayout>
      <DynamicFlash />
      <Card className="mx-auto my-2 w-full max-w-3xl">
        <CardHeader>
          <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
            <Flexbox direction="row" alignItems="center" gap="2" wrap="wrap">
              <Text lg semibold>
                ManaMatrix
              </Text>
              {puzzle && (
                <Text md className="text-text-secondary">
                  {formatDate(puzzle.date)}
                  {isArchive ? ' · archive puzzle' : ''}
                </Text>
              )}
            </Flexbox>
            <Flexbox direction="row" gap="3" alignItems="center">
              {isArchive && <Link href="/tool/manamatrix">Today's Puzzle</Link>}
              <Link href="/tool/manamatrix/archive">Archive</Link>
            </Flexbox>
          </Flexbox>
        </CardHeader>
        <CardBody>
          {!puzzle ? (
            <Text className="text-center text-text-secondary">
              No puzzle is available yet. Check back soon — a new ManaMatrix is posted every day!
            </Text>
          ) : (
            <Flexbox direction="col" gap="2">
              <Text xs className="text-center text-text-secondary">
                Name a card for each cell matching both its row and column category.
                {isArchive && " Past puzzles count toward your totals, but only today's puzzle continues a streak."}
                {!user && (
                  <>
                    {' '}
                    <Link href="/user/login">Log in</Link> to keep your history, streak, and answer popularity.
                  </>
                )}
              </Text>

              <Flexbox direction="row" justify="center" gap="4">
                <Text sm className="text-text-secondary">
                  Guesses: <span className="font-semibold text-text">{attempts}</span>
                </Text>
                <Text sm className="text-text-secondary">
                  {correct ? 'Solved' : 'Filled'}:{' '}
                  <span className="font-semibold text-text">{correct ? solvedCount : filledCount} / 9</span>
                </Text>
              </Flexbox>

              <ManaMatrixGrid
                puzzle={puzzle}
                values={values}
                correct={correct}
                submitting={submitting}
                popularity={popularity}
                onCellClick={(row, col) => {
                  // Freeze the board while a check is in flight — the response
                  // echoes the grid as of submit time and would clobber edits.
                  if (submitting || correct?.[row]?.[col]) {
                    return;
                  }
                  setModalCell({ row, col });
                }}
                onCategoryClick={setCategoryModal}
              />

              {error && (
                <Text sm className="text-center text-red-500">
                  {error}
                </Text>
              )}

              {!isComplete && (
                <Flexbox direction="row" justify="center">
                  <Button color="primary" onClick={submit} disabled={submitting || filledCount === 0}>
                    {submitting ? 'Checking...' : correct ? 'Check again!' : 'Check your score!'}
                  </Button>
                </Flexbox>
              )}

              {correct && (
                <ManaMatrixResults
                  puzzle={puzzle}
                  values={values}
                  correct={correct}
                  popularity={popularity}
                  attempts={user || attempts > 0 ? attempts : null}
                  stats={stats}
                  isArchive={isArchive}
                />
              )}
            </Flexbox>
          )}
        </CardBody>
      </Card>

      {puzzle && modalCell && (
        <ManaMatrixCellModal
          key={`${modalCell.row}-${modalCell.col}`}
          isOpen
          setOpen={(open) => {
            if (!open) {
              setModalCell(null);
            }
          }}
          cellDescription={`${puzzle.rows[modalCell.row]?.description ?? ''} and ${puzzle.columns[modalCell.col]?.description ?? ''}`}
          initialValue={values[modalCell.row]?.[modalCell.col] ?? ''}
          onPick={(value) => setCellValue(modalCell.row, modalCell.col, value)}
        />
      )}

      {categoryModal && (
        <Modal isOpen setOpen={(open) => !open && setCategoryModal(null)} sm>
          <ModalHeader setOpen={(open) => !open && setCategoryModal(null)}>
            <Text semibold lg>
              Category
            </Text>
          </ModalHeader>
          <ModalBody>
            <Flexbox direction="col" gap="2">
              <Text>{categoryModal.description}</Text>
              <code className="self-start rounded border border-border bg-bg px-1.5 py-0.5 text-sm text-text-secondary">
                {categoryModal.filterText}
              </code>
            </Flexbox>
          </ModalBody>
        </Modal>
      )}
    </MainLayout>
  );
};

export default RenderToRoot(ManaMatrixPage);
