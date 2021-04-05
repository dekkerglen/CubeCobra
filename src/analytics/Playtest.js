import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

import CardPropType from 'proptypes/CardPropType';
import CubePropType from 'proptypes/CubePropType';

import { compareStrings, SortableTable } from 'components/SortableTable';
import { fromEntries } from 'utils/Util';
import ErrorBoundary from 'components/ErrorBoundary';
import { mainboardRate, pickRate } from 'utils/Card';

const AnalyticTable = ({ cards: allCards, cube }) => {
  console.log(cube.cardAnalytics);
  console.log(allCards);

  const cardDict = useMemo(() => fromEntries(allCards.map((card) => [card.details.name.toLowerCase(), card])), [
    allCards,
  ]);

  const data = useMemo(
    () =>
      cube.cardAnalytics
        .filter((cardAnalytic) => cardDict[cardAnalytic.cardName])
        .map(({ cardName, elo, mainboards, sideboards, picks, passes }) => ({
          cardName: cardDict[cardName].details.name,
          elo: Math.round(elo),
          mainboard: mainboardRate({ mainboards, sideboards }),
          pickrate: pickRate({ picks, passes }),
          picks,
        })),
    [cube, cardDict],
  );

  return (
    <>
      <ErrorBoundary>
        <SortableTable
          columnProps={[
            { key: 'cardName', title: 'Card Name', heading: true, sortable: true },
            { key: 'elo', title: 'Cube Elo', sortable: true, heading: false },
            { key: 'mainboard', title: 'Mainboard Rate', sortable: true, heading: false },
            { key: 'pickrate', title: 'Pick Rate', sortable: true, heading: false },
            { key: 'picks', title: 'Pick Count', sortable: true, heading: false },
          ]}
          data={data}
          sortFns={{ label: compareStrings }}
        />
      </ErrorBoundary>
    </>
  );
};

AnalyticTable.propTypes = {
  cards: PropTypes.arrayOf(CardPropType.isRequired).isRequired,
  cube: CubePropType.isRequired,
};

export default AnalyticTable;
