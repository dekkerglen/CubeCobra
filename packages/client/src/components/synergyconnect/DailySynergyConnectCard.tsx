import React from 'react';

import { SynergyConnectBoard } from '@utils/datatypes/SynergyConnect';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';

interface DailySynergyConnectCardProps {
  board: SynergyConnectBoard;
}

/**
 * The dashboard teaser for today's Synergy Connect, built to match
 * DailyManaMatrixCard: a header with the date and an archive link, a line of
 * orientation, the day's board as a clickable preview, and a call to action.
 *
 * The preview is the real board — the same sixteen cards in the same order — because
 * that is what makes the card worth clicking. It is safe to show precisely because
 * `SynergyConnectBoard` is the server's withholding shape: no group membership and no
 * commander names, so laying the cards out reveals nothing the game page wouldn't.
 */
const DailySynergyConnectCard: React.FC<DailySynergyConnectCardProps> = ({ board }) => {
  if (!board) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap">
          <Text semibold lg>
            Synergy Connect —{' '}
            {new Date(`${board.date}T00:00:00`).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Link href="/tool/synergyconnect/archive">Archive</Link>
        </Flexbox>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text sm className="text-text-secondary">
            Find the four groups of four cards that each synergize with the same legendary creature. Today's are all{' '}
            <span className="font-semibold text-text">legendary creatures {board.theme.description}</span>.
          </Text>

          <a href="/tool/synergyconnect" className="block no-underline-hover">
            {/* The grid lives on an inner div: a global rule forces anchors back to
                `display: inline`, so an anchor can be block or flex but never grid. */}
            <div className="mx-auto grid w-full max-w-xl grid-cols-4 gap-1.5">
              {board.cards.map((card) => (
                <img
                  key={card.oracleId}
                  // Accepts an oracle id and redirects to the card's default printing.
                  src={`/tool/cardimage/${encodeURIComponent(card.oracleId)}`}
                  alt={card.name}
                  loading="lazy"
                  className="block aspect-[63/88] w-full rounded-md border border-border object-cover"
                />
              ))}
            </div>
          </a>

          <Link href="/tool/synergyconnect">Play today's puzzle →</Link>
        </Flexbox>
      </CardBody>
    </Card>
  );
};

export default DailySynergyConnectCard;
