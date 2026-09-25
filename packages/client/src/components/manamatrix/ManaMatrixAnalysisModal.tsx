import React, { useEffect, useState } from 'react';

import { ManaMatrixCellAnalysis, ManaMatrixPuzzle } from '@utils/datatypes/ManaMatrix';
import classNames from 'classnames';

import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import { Modal, ModalBody, ModalHeader } from 'components/base/Modal';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import withAutocard from 'components/WithAutocard';

const AutocardLink = withAutocard(Link);

export interface ManaMatrixAnalysisModalProps {
  puzzle: ManaMatrixPuzzle;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const SelectorChip: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex h-full w-full items-center justify-center rounded-md border border-border bg-bg p-1 text-center">
    <span className="max-w-full break-words text-[10px] font-semibold leading-tight">{text}</span>
  </div>
);

/**
 * "How the community solved it": pick a cell in the mini board to see every
 * valid answer with community guess counts. Offered after the player submits.
 */
const ManaMatrixAnalysisModal: React.FC<ManaMatrixAnalysisModalProps> = ({ puzzle, isOpen, setOpen }) => {
  const [analysis, setAnalysis] = useState<ManaMatrixCellAnalysis[][] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ row: number; col: number }>({ row: 0, col: 0 });

  // NOTE: `loading` must stay out of the deps — setting it inside would re-run
  // the effect and its cleanup would cancel the in-flight fetch.
  useEffect(() => {
    if (!isOpen || analysis) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const response = await fetch(`/tool/api/manamatrix/analysis/${puzzle.date}`);
        const data = await response.json();
        if (cancelled) {
          return;
        }
        if (!response.ok || !data.success) {
          setError(data.error ?? 'Error loading analysis');
        } else {
          setAnalysis(data.analysis);
        }
      } catch {
        if (!cancelled) {
          setError('Error loading analysis');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, analysis, puzzle.date]);

  const selectedAnalysis = analysis?.[selected.row]?.[selected.col];
  const selectedTitle = `${puzzle.rows[selected.row]?.description} and ${puzzle.columns[selected.col]?.description}`;

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md scrollable>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Community Answers
        </Text>
      </ModalHeader>
      <ModalBody scrollable>
        {loading && (
          <Flexbox direction="row" justify="center" className="my-4">
            <Spinner />
          </Flexbox>
        )}

        {error && (
          <Text sm className="text-center text-red-500">
            {error}
          </Text>
        )}

        {analysis && (
          <Flexbox direction="col" gap="3">
            {/* Cell picker, laid out like the board. */}
            <div className="mx-auto grid w-full max-w-md grid-cols-[repeat(4,minmax(0,1fr))] gap-1 sm:grid-cols-[minmax(3.5rem,6rem)_repeat(3,minmax(0,1fr))]">
              <div />
              {puzzle.columns.map((category, col) => (
                <SelectorChip key={`col-${col}`} text={category.filterText} />
              ))}
              {puzzle.rows.map((rowCategory, row) => (
                <React.Fragment key={`row-${row}`}>
                  <SelectorChip text={rowCategory.filterText} />
                  {[0, 1, 2].map((col) => {
                    const isSelected = selected.row === row && selected.col === col;
                    const cell = analysis[row]?.[col];
                    return (
                      <button
                        key={`cell-${row}-${col}`}
                        type="button"
                        onClick={() => setSelected({ row, col })}
                        aria-pressed={isSelected}
                        aria-label={`${puzzle.rows[row]?.description} and ${puzzle.columns[col]?.description}`}
                        className={classNames(
                          'rounded-md px-1 py-2 text-center text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                          isSelected
                            ? 'border-2 border-link bg-bg-active font-semibold'
                            : 'border border-border hover:bg-bg-active',
                        )}
                      >
                        {cell ? `${cell.totalCards.toLocaleString()} cards` : '—'}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {selectedAnalysis && (
              <Flexbox direction="col" gap="1">
                <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap">
                  <Text sm semibold>
                    {selectedTitle}
                  </Text>
                  <Text xs className="text-text-secondary">
                    {selectedAnalysis.totalGuesses} guess{selectedAnalysis.totalGuesses === 1 ? '' : 'es'} ·{' '}
                    {selectedAnalysis.totalCards} valid card{selectedAnalysis.totalCards === 1 ? '' : 's'}
                  </Text>
                </Flexbox>
                <div className="max-h-96 overflow-y-auto rounded-md border border-border">
                  {selectedAnalysis.validCards.map((entry) => (
                    <Flexbox
                      key={entry.name}
                      direction="row"
                      justify="between"
                      gap="2"
                      className="border-b border-border px-2 py-1 text-sm last:border-b-0"
                    >
                      <AutocardLink
                        href={`/tool/card/${encodeURIComponent(entry.name)}`}
                        card={{ details: { image_normal: `/tool/cardimage/${encodeURIComponent(entry.name)}` } } as any}
                        className="truncate"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {entry.name}
                      </AutocardLink>
                      <span
                        className={classNames('shrink-0 tabular-nums', {
                          'text-text-secondary': entry.guesses === 0,
                        })}
                      >
                        {entry.guesses > 0 ? `${entry.guesses} (${entry.percentage}%)` : '—'}
                      </span>
                    </Flexbox>
                  ))}
                  {selectedAnalysis.validCards.length === 0 && (
                    <Text sm className="px-2 py-1 text-text-secondary">
                      No valid cards found.
                    </Text>
                  )}
                </div>
              </Flexbox>
            )}
          </Flexbox>
        )}
      </ModalBody>
    </Modal>
  );
};

export default ManaMatrixAnalysisModal;
