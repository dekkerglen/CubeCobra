import React, { useMemo } from 'react';
import { ListGroupItem } from 'reactstrap';

import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';
import CubeAnalyticPropType from 'proptypes/CubeAnalyticPropType';

import ErrorBoundary from 'components/ErrorBoundary';
import { compareStrings, SortableTable } from 'components/SortableTable';
import withAutocard from 'components/WithAutocard';
import { encodeName, mainboardRate, pickRate } from 'utils/Card';
import { fromEntries } from 'utils/Util';

const AutocardItem = withAutocard(ListGroupItem);

const renderCardLink = (card) => (
  <AutocardItem className="p-0" key={card.index} card={card} data-in-modal index={card.index}>
    <a href={`/tool/card/${encodeName(card.cardID)}`} target="_blank" rel="noopener noreferrer">
      {card.details.name}
    </a>
  </AutocardItem>
);

const renderPercent = (val) => {
  return <>{parseInt(val * 1000, 10) / 10}%</>;
};

const PlaytestData = ({ cards, cubeAnalytics }) => {
  const cardDict = useMemo(() => fromEntries(cards.map((card) => [card.details.oracle_id, card])), [cards]);

  const data = useMemo(
    () =>
      Object.entries(cubeAnalytics)
        .filter(([oracle]) => cardDict[oracle])
        .map(([oracle, { elo, mainboards, sideboards, picks, passes }]) => ({
          card: {
            exportValue: oracle,
            ...cardDict[oracle],
          },
          elo: Math.round(elo || 1200),
          mainboard: mainboardRate({ mainboards: mainboards || 0, sideboards: sideboards || 0 }),
          pickrate: pickRate({ picks: picks || 0, passes: passes || 0 }),
          picks: picks || 0,
          mainboards: mainboards || 0,
        })),
    [cubeAnalytics, cardDict],
  );

  return (
    <>
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
          sortFns={{ label: compareStrings }}
        />
      </ErrorBoundary>
    </>
  );
};

PlaytestData.propTypes = {
  cards: PropTypes.arrayOf(CardPropType.isRequired).isRequired,
  cubeAnalytics: CubeAnalyticPropType.isRequired,
};

export default PlaytestData;
