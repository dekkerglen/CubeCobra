import React, { useState } from 'react';
import PropTypes from 'prop-types';
import PivotTableUI from 'react-pivottable/PivotTableUI';

import { cardPrice, cardFoilPrice, cardPriceEur, cardTix } from 'utils/Card';

const PivotTable = ({ cards }) => {
  const data = cards.map((card) => ({
    CMC: card.cmc ?? card.details.cmc,
    Color: (card.colors || []).join(),
    Finish: card.finish,
    'Type Line': card.type_line,
    Status: card.status,
    Set: card.details.set,
    Name: card.details.name,
    Artist: card.details.artist,
    Rarity: card.details.rarity,
    'Price USD': cardPrice(card),
    'Price USD Foil': cardFoilPrice(card),
    'Price EUR': cardPriceEur(card),
    'Price TIX': cardTix(card),
    Elo: card.details.elo,
  }));

  const [state, updateState] = useState(data);

  return (
    <>
      <h4>Pivot Table</h4>
      <PivotTableUI data={data} onChange={updateState} {...state} />
    </>
  );
};
PivotTable.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default PivotTable;
