import React from 'react';

import { ManaMatrixPuzzle } from '@utils/datatypes/ManaMatrix';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import ManaMatrixBoardPreview from 'components/manamatrix/ManaMatrixBoardPreview';

interface DailyManaMatrixCardProps {
  puzzle: ManaMatrixPuzzle;
}

/**
 * The dashboard teaser for today's Mana Matrix.
 *
 * Only ever rendered for a puzzle the viewer has not started — the dashboard slot picks
 * from the games they have not touched — so the board is always empty and there is no
 * progress to report. ManaMatrixBoardPreview is the piece that also renders a played
 * board, in the archive.
 */
const DailyManaMatrixCard: React.FC<DailyManaMatrixCardProps> = ({ puzzle }) => {
  if (!puzzle) {
    return null;
  }

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
            Name a card for each cell matching both its row and column category. Today's puzzle is waiting.
          </Text>

          <a href="/tool/manamatrix" className="block no-underline-hover">
            <ManaMatrixBoardPreview puzzle={puzzle} />
          </a>

          <Link href="/tool/manamatrix">Play today's puzzle →</Link>
        </Flexbox>
      </CardBody>
    </Card>
  );
};

export default DailyManaMatrixCard;
