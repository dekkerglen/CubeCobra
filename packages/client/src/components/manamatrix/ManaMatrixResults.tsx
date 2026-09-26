import React, { useCallback, useState } from 'react';

import { ManaMatrixCellPopularity, ManaMatrixPuzzle, ManaMatrixUserStats } from '@utils/datatypes/ManaMatrix';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import ManaMatrixAnalysisModal from 'components/manamatrix/ManaMatrixAnalysisModal';
import { renderManaMatrixImage } from 'components/manamatrix/manaMatrixImage';
import ManaMatrixStats from 'components/manamatrix/ManaMatrixStats';

const MESSAGES = [
  'Today might not be your day.',
  'A start is a start!',
  'Getting somewhere!',
  'A third of the way there!',
  'Almost half!',
  'Not too bad!',
  'Solidly done!',
  'Very nice!',
  'So close to perfection!',
  'A perfect score!',
];

type CopyState = 'idle' | 'copied' | 'downloaded' | 'failed';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export interface ManaMatrixResultsProps {
  puzzle: ManaMatrixPuzzle;
  values: string[][];
  correct: (boolean | null)[][];
  popularity: (ManaMatrixCellPopularity | null)[][] | null;
  attempts: number | null;
  stats: ManaMatrixUserStats | null;
  isArchive: boolean;
}

/**
 * Compact results strip rendered inside the game card (not its own Card), so
 * the whole game state stays on one screen.
 */
const ManaMatrixResults: React.FC<ManaMatrixResultsProps> = ({
  puzzle,
  values,
  correct,
  popularity,
  attempts,
  stats,
  isArchive,
}) => {
  const [textCopyState, setTextCopyState] = useState<CopyState>('idle');
  const [imageCopyState, setImageCopyState] = useState<CopyState>('idle');
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const numCorrect = correct.flat().filter((cell) => cell === true).length;

  const shareText = useCallback(async () => {
    // ️ (variation selector-16) forces emoji presentation; without it some
    // platforms render these as monochrome text glyphs when pasted.
    const grid = correct
      .map((row) => row.map((cell) => (cell === true ? '✅️' : cell === false ? '❌️' : '⬜️')).join(' '))
      .join('\n');
    const attemptsLine =
      attempts !== null ? `\nAnd it only took me ${attempts} attempt${attempts === 1 ? '' : 's'}!` : '';
    const text = `My results for the ${puzzle.date} Mana Matrix:\n${grid}${attemptsLine}\nTry it for yourself here: ${window.location.origin}/manamatrix`;

    try {
      await navigator.clipboard.writeText(text);
      setTextCopyState('copied');
    } catch {
      setTextCopyState('failed');
    }
    setTimeout(() => setTextCopyState('idle'), 2000);
  }, [correct, attempts, puzzle.date]);

  const shareImage = useCallback(async () => {
    let blob: Blob;
    try {
      blob = await renderManaMatrixImage({
        date: puzzle.date,
        columns: puzzle.columns,
        rows: puzzle.rows,
        values,
        correct,
        popularity,
      });
    } catch {
      setImageCopyState('failed');
      setTimeout(() => setImageCopyState('idle'), 2000);
      return;
    }

    // Image clipboards are flaky across browsers (no ClipboardItem, focus
    // requirements, permission prompts) — fall back to downloading the PNG.
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        throw new Error('image clipboard unsupported');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setImageCopyState('copied');
    } catch {
      try {
        downloadBlob(blob, `manamatrix-${puzzle.date}.png`);
        setImageCopyState('downloaded');
      } catch {
        setImageCopyState('failed');
      }
    }
    setTimeout(() => setImageCopyState('idle'), 2000);
  }, [puzzle, values, correct, popularity]);

  return (
    <Flexbox direction="col" gap="2" alignItems="center">
      <Text sm>
        {numCorrect} out of 9 correct.{!isArchive && ` ${MESSAGES[numCorrect]}`}
      </Text>
      <Flexbox direction="row" gap="2" justify="center" wrap="wrap">
        <Button color="secondary" onClick={shareText} className="text-sm">
          <span aria-live="polite">
            {textCopyState === 'copied' ? 'Copied!' : textCopyState === 'failed' ? "Couldn't copy" : 'Copy results'}
          </span>
        </Button>
        <Button color="secondary" onClick={shareImage} className="text-sm">
          <span aria-live="polite">
            {imageCopyState === 'copied'
              ? 'Copied!'
              : imageCopyState === 'downloaded'
                ? 'Downloaded!'
                : imageCopyState === 'failed'
                  ? "Couldn't copy"
                  : 'Copy image'}
          </span>
        </Button>
        <Button color="secondary" onClick={() => setAnalysisOpen(true)} className="text-sm">
          Community answers
        </Button>
      </Flexbox>
      {stats && !isArchive && <ManaMatrixStats stats={stats} />}
      <ManaMatrixAnalysisModal puzzle={puzzle} isOpen={analysisOpen} setOpen={setAnalysisOpen} />
    </Flexbox>
  );
};

export default ManaMatrixResults;
