import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

import { Col, Row } from 'reactstrap';

import ErrorBoundary from 'components/ErrorBoundary';
import { compareStrings, SortableTable } from 'components/SortableTable';
import { cardEtchedPrice, cardFoilPrice, cardNormalPrice, cardPrice, cardStatus } from 'utils/Card';

const Prices = ({ cards }) => {
  const getValue = (collection, allowedStatus, allowedFinish) => {
    const allowedStatuses = [];
    if (allowedStatus === 'Owned' || allowedStatus === 'Any') allowedStatuses.push('Ordered', 'Owned', 'Premium Owned');
    if (allowedStatus === 'Not Owned' || allowedStatus === 'Any') allowedStatuses.push('Not Owned', 'Proxied');

    let priceFn;
    switch (allowedFinish) {
      case 'Non-foil':
        priceFn = cardNormalPrice;
        break;
      case 'Foil':
        priceFn = cardFoilPrice;
        break;
      case 'Etched':
        priceFn = cardEtchedPrice;
        break;
      default:
        priceFn = cardPrice;
    }

    return '$'.concat(
      parseFloat(
        collection
          .map((card) => {
            if (allowedStatuses.find((status) => status === cardStatus(card))) return priceFn(card) ?? 0;
            return 0;
          })
          .reduce((acc, price) => acc + price),
      ).toFixed(2),
    );
  };

  const prices = useMemo(
    () =>
      ['Non-foil', 'Foil', 'Etched', 'All'].map((finish) => ({
        label: finish,
        currentValue: getValue(cards, 'Owned', finish),
        toComplete: getValue(cards, 'Not Owned', finish),
        totalValue: getValue(cards, 'Any', finish),
      })),
    [cards],
  );

  return (
    <>
      <Row>
        <Col>
          <h4 className="d-lg-block d-none">Prices</h4>
          <p>View the expected value of cards owned and unowned.</p>
        </Col>
      </Row>
      <ErrorBoundary>
        <SortableTable
          columnProps={[
            { key: 'label', title: 'Finish', heading: true, sortable: true },
            { key: 'currentValue', title: 'Current Value', heading: false, sortable: true },
            { key: 'toComplete', title: 'To Complete', heading: false, sortable: true },
            { key: 'totalValue', title: 'Total Value', heading: false, sortable: true },
          ]}
          data={prices}
          sortFns={{ label: compareStrings }}
        />
      </ErrorBoundary>
    </>
  );
};

Prices.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default Prices;
