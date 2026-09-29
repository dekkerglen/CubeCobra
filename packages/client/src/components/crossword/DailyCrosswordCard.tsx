import React from 'react';

import { CrosswordShapeTeaser } from '@utils/datatypes/DailyGameTeaser';
import classNames from 'classnames';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';

interface DailyCrosswordCardProps {
  shape: CrosswordShapeTeaser;
}

/**
 * The dashboard teaser for today's crossword, built to match DailyManaMatrixCard.
 *
 * The preview is the grid's silhouette — white cells and black squares, drawn with the
 * same square box, 1px gaps and border colour CrosswordGrid uses, so the card and the
 * game read as the same object. It is deliberately all this card gets: the props come
 * from `CrosswordShapeTeaser`, which the server derives from its `toBoard` boundary, so
 * there is no letter and no entry text on this page to leak. Not even the clues are
 * here — a silhouette is the tease.
 */
const DailyCrosswordCard: React.FC<DailyCrosswordCardProps> = ({ shape }) => {
  if (!shape) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap">
          <Text semibold lg>
            Crossword —{' '}
            {new Date(`${shape.date}T00:00:00`).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Link href="/tool/crossword/archive">Archive</Link>
        </Flexbox>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text sm className="text-text-secondary">
            {shape.width}×{shape.height}, <span className="font-semibold text-text">{shape.clueCount} clues</span>, all
            of them Magic. The clock starts when you open it.
          </Text>

          <a href="/tool/crossword" className="block no-underline-hover">
            {/* The grid lives on an inner div: a global rule forces anchors back to
                `display: inline`, so an anchor can be block or flex but never grid. */}
            <div
              className="mx-auto grid aspect-square w-full max-w-[18rem] gap-px border border-border bg-border"
              style={{
                gridTemplateColumns: `repeat(${shape.width}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${shape.height}, minmax(0, 1fr))`,
              }}
              role="img"
              aria-label={`Today's crossword: a ${shape.width} by ${shape.height} grid with ${shape.clueCount} clues`}
            >
              {shape.blocks.map((row, rowIndex) =>
                row.map((blocked, colIndex) => (
                  <div key={`${rowIndex},${colIndex}`} className={classNames(blocked ? 'bg-black' : 'bg-bg')} />
                )),
              )}
            </div>
          </a>

          <Link href="/tool/crossword">Solve today's puzzle →</Link>
        </Flexbox>
      </CardBody>
    </Card>
  );
};

export default DailyCrosswordCard;
