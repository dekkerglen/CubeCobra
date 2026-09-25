import React from 'react';

import { ManaMatrixUserStats } from '@utils/datatypes/ManaMatrix';

import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';

const Stat: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <Flexbox direction="col" alignItems="center">
    <Text semibold lg>
      {value}
    </Text>
    <Text xs className="text-text-secondary">
      {label}
    </Text>
  </Flexbox>
);

/** Row of the user's aggregate stats, shared by the play page and the archive. */
const ManaMatrixStats: React.FC<{ stats: ManaMatrixUserStats }> = ({ stats }) => (
  <Flexbox direction="row" justify="center" gap="6" wrap="wrap">
    <Stat value={stats.currentStreak} label="Current Streak" />
    <Stat value={stats.longestStreak} label="Best Streak" />
    <Stat value={stats.totalPlayed} label="Days Played" />
    <Stat value={stats.perfectDays} label="Perfect Days" />
  </Flexbox>
);

export default ManaMatrixStats;
