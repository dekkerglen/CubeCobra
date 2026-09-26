import React from 'react';

import { ManaMatrixPuzzle, ManaMatrixSubmission } from '@utils/datatypes/ManaMatrix';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import ManaMatrixBoardPreview from 'components/manamatrix/ManaMatrixBoardPreview';

interface DailyManaMatrixCardProps {
  puzzle: ManaMatrixPuzzle;
  submission?: ManaMatrixSubmission | null;
}

const DailyManaMatrixCard: React.FC<DailyManaMatrixCardProps> = ({ puzzle, submission }) => {
  if (!puzzle) {
    return null;
  }

  const solved = submission ? submission.correct.flat().filter(Boolean).length : null;

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap">
          <Text semibold lg>
            Mana Matrix —{' '}
            {new Date(`${puzzle.date}T00:00:00`).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Link href="/tool/manamatrix/archive">Archive</Link>
        </Flexbox>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text sm className="text-text-secondary">
            {solved !== null ? (
              <>
                You've solved <span className="font-semibold text-text">{solved} of 9</span> cells
                {submission ? ` in ${submission.attempts} guess${submission.attempts === 1 ? '' : 'es'}` : ''}.
              </>
            ) : (
              "Name a card for each cell matching both its row and column category. Today's puzzle is waiting."
            )}
          </Text>

          <a href="/tool/manamatrix" className="block no-underline-hover">
            <ManaMatrixBoardPreview puzzle={puzzle} submission={submission} />
          </a>

          <Link href="/tool/manamatrix">{solved !== null ? 'Continue playing' : "Play today's puzzle"} →</Link>
        </Flexbox>
      </CardBody>
    </Card>
  );
};

export default DailyManaMatrixCard;
