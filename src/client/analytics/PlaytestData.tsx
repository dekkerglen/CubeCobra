import React, { useContext, useMemo } from 'react';

import { cardName, cardNameLower, cardOracleId, encodeName, mainboardRate, pickRate } from 'utils/cardutil';
import { fromEntries } from 'utils/Util';

import Card, { DefaultElo } from '../../datatypes/Card';
import { Flexbox } from '../components/base/Layout';
import ErrorBoundary from '../components/ErrorBoundary';
import { SortableTable } from '../components/SortableTable';
import withAutocard from '../components/WithAutocard';
import CubeContext from '../contexts/CubeContext';

interface CubeAnalytics {
  [oracle_id: string]: {
    elo: number;
    mainboards: number;
    sideboards: number;
    picks: number;
    passes: number;
  };
}

interface PlaytestDataProps {
  cubeAnalytics: CubeAnalytics;
}

const AutocardItem = withAutocard('div');

const renderCardLink = (card: Card) => (
  <AutocardItem className="p-0" key={card.index} card={card}>
    <a href={`/tool/card/${encodeName(card.cardID)}`} target="_blank" rel="noopener noreferrer">
      {cardName(card)}
    </a>
  </AutocardItem>
);

const renderPercent = (val: number) => {
  return <>{parseInt((val * 1000).toString(), 10) / 10}%</>;
};

const compareCardNames = (a: Card, b: Card): number => {
  return cardNameLower(a).localeCompare(cardNameLower(b));
};

const PlaytestData: React.FC<PlaytestDataProps> = ({ cubeAnalytics }) => {
  const { changedCards } = useContext(CubeContext);
  const cards = changedCards.mainboard;

  const cardDict = useMemo(
    () => fromEntries(cards.filter((card) => cardOracleId(card)).map((card) => [cardOracleId(card), card])),
    [cards],
  );

  const data = useMemo(
    () =>
      Object.entries(cubeAnalytics)
        .filter(([oracle]) => cardDict[oracle])
        .map(([oracle, { elo, mainboards, sideboards, picks, passes }]) => ({
          card: {
            exportValue: cardName(cardDict[oracle]),
            ...cardDict[oracle],
          },
          elo: Math.round(elo || DefaultElo),
          mainboard: mainboardRate({ mainboards: mainboards || 0, sideboards: sideboards || 0 }),
          pickrate: pickRate({ picks: picks || 0, passes: passes || 0 }),
          picks: picks || 0,
          mainboards: mainboards || 0,
        })),
    [cubeAnalytics, cardDict],
  );

  return (
    <Flexbox direction="col" gap="2" className="m-2">
      <ErrorBoundary>
        <SortableTable
          columnProps={[
            {
              key: 'card',
              title: 'Card name',
              heading: true,
              sortable: true,
              renderFn: renderCardLink,
            },
            { key: 'elo', title: 'Cube Elo', sortable: true, heading: false },
            { key: 'pickrate', title: 'Pick Rate', sortable: true, heading: false, renderFn: renderPercent },
            { key: 'picks', title: 'Pick Count', sortable: true, heading: false },
            { key: 'mainboard', title: 'Mainboard Rate', sortable: true, heading: false, renderFn: renderPercent },
            { key: 'mainboards', title: 'Mainboard Count', sortable: true, heading: false },
          ]}
          data={data}
          sortFns={{ card: compareCardNames }}
        />
      </ErrorBoundary>
    </Flexbox>
  );
};

export default PlaytestData;
