import React, { useState } from 'react';
import PropTypes from 'prop-types';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import { cardPrice, cardFoilPrice, cardPriceEur, cardTix } from 'utils/Card';

const PivotTable = ({ cards, characteristics }) => {
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
    'Cube ELO': characteristics['Cube ELO'](card),
    'Mainboard Rate': characteristics['Mainboard Rate'](card),
    'Pick Rate': characteristics['Pick Rate'](card),
    'Pick Count': characteristics['Pick Count'](card),
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
  characteristics: PropTypes.shape({}).isRequired,
};

export default PivotTable;
