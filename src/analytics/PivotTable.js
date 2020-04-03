import React, { useState } from 'react';
import PropTypes from 'prop-types';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import 'react-pivottable/pivottable.css';

import { Col } from 'reactstrap';

const PivotTable = ({ cards }) => {
  const data = cards.map((card) => ({
    CMC: card.cmc || card.details.cmc,
    Color: card.colors.join(),
    Finish: card.finish,
    'Type Line': card.type_line,
    Status: card.status,
    Set: card.details.set,
    Name: card.details.name,
    Artist: card.details.artist,
    Rarity: card.details.rarity,
    Price: card.details.price,
    Elo: card.details.elo,
  }));

  const [state, updateState] = useState(data);

  return (
    <Col xs="12" lg="10" className="overflow-x">
      <h4>Pivot Table</h4>
      <PivotTableUI data={data} onChange={updateState} {...state} />
    </Col>
  );
};

export default PivotTable;
