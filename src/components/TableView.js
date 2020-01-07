import React, { useContext } from 'react';

import { Row, Col } from 'reactstrap';

import { countGroup, sortDeep } from '../util/Sort';

import AutocardListGroup from './AutocardListGroup';
import DisplayContext from './DisplayContext';
import SortContext from './SortContext';

const TableView = ({ cards, ...props }) => {
  const { primary, secondary } = useContext(SortContext);
  const { compressedView } = useContext(DisplayContext);

  const sorted = sortDeep(cards, primary, secondary);

  return (
    <div className="table-view-container">
      <Row className={'table-view' + (compressedView ? ' compressed' : '')} {...props}>
        {sorted.map(([columnLabel, column]) => (
          <Col
            key={columnLabel}
            md="auto"
            className="mt-3 table-col"
            style={{ width: `${100 / Math.min(sorted.length, 8)}%` }}
          >
            <h6 className="text-center card-list-heading">
              {columnLabel}
              <br />({countGroup(column)})
            </h6>
            {column.map(([label, row]) => (
              <AutocardListGroup key={label} heading={`${label} (${countGroup(row)})`} cards={row} />
            ))}
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default TableView;
