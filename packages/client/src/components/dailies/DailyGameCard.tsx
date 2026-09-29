import React from 'react';

import { DAILY_GAME_KEYS } from '@utils/datatypes/DailyGameStats';
import { DAILY_GAME_HREFS, DAILY_GAME_NAMES, DailyGameTeaserResult } from '@utils/datatypes/DailyGameTeaser';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import DailyCrosswordCard from 'components/crossword/DailyCrosswordCard';
import DailyManaMatrixCard from 'components/manamatrix/DailyManaMatrixCard';
import DailyP1P1Card from 'components/p1p1/DailyP1P1Card';
import DailySynergyConnectCard from 'components/synergyconnect/DailySynergyConnectCard';

/**
 * Shown once the viewer has started every daily there is today.
 *
 * Deliberately not a fallback to one of the games they already played: re-rendering a
 * board they have finished reads as a bug, and the honest answer to "nothing new" is a
 * small, cheap acknowledgement plus the same links the Dailies menu carries.
 */
const AllPlayedCard: React.FC = () => (
  <Card>
    <CardHeader>
      <Text semibold lg>
        Today's Dailies
      </Text>
    </CardHeader>
    <CardBody>
      <Flexbox direction="col" gap="2">
        <Text sm className="text-text-secondary">
          You've played today's games. New puzzles land every day — until then, the archives are open.
        </Text>
        <Flexbox direction="row" gap="3" wrap="wrap">
          {DAILY_GAME_KEYS.map((game) => (
            <Link key={game} href={DAILY_GAME_HREFS[game]}>
              {DAILY_GAME_NAMES[game]}
            </Link>
          ))}
        </Flexbox>
      </Flexbox>
    </CardBody>
  </Card>
);

export interface DailyGameCardProps {
  dailyGame?: DailyGameTeaserResult | null;
}

/**
 * The dashboard's daily-game slot.
 *
 * The server picks which of the four games to show (see serverutils/dailyGamePick.ts);
 * this only dispatches on that choice. Renders nothing at all when there is no teaser
 * and nothing was played — a day with no live puzzles should leave the slot empty
 * rather than congratulate anyone.
 */
const DailyGameCard: React.FC<DailyGameCardProps> = ({ dailyGame }) => {
  const teaser = dailyGame?.teaser;

  if (!teaser) {
    return dailyGame?.allPlayed ? <AllPlayedCard /> : null;
  }

  switch (teaser.game) {
    case 'dailyp1p1':
      return <DailyP1P1Card pack={teaser.pack} cube={teaser.cube} date={teaser.date} />;
    case 'manamatrix':
      return <DailyManaMatrixCard puzzle={teaser.puzzle} />;
    case 'synergyconnect':
      return <DailySynergyConnectCard board={teaser.board} />;
    case 'crossword':
      return <DailyCrosswordCard shape={teaser.shape} />;
    default:
      return null;
  }
};

export default DailyGameCard;
