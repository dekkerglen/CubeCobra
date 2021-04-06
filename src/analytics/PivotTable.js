import React, { useState } from 'react';
import PropTypes from 'prop-types';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import { fromEntries } from 'utils/Util';

const PivotTable = ({ cards, characteristics }) => {
  const data = cards.map((card) =>
    fromEntries(
      [['Color', (card.colors || []).join()]].concat(
        Object.entries(characteristics).map(([key, value]) => [key, value.get(card)]),
      ),
    ),
  );
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
  characteristics: PropTypes.shape({
    'Cube Elo': PropTypes.func.isRequired,
    'Mainboard Rate': PropTypes.func.isRequired,
    'Mainboard Count': PropTypes.func.isRequired,
    'Pick Rate': PropTypes.func.isRequired,
    'Pick Count': PropTypes.func.isRequired,
  }).isRequired,
};

export default PivotTable;
