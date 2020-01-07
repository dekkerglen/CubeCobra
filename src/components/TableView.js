import React, { useEffect } from 'react';

import { Row, Col } from 'reactstrap';

import { countGroup, sortDeep } from '../util/Sort';

import AutocardListGroup from './AutocardListGroup';
import SortContext from './SortContext';

const TableViewRaw = ({ cards, primary, secondary, tertiary, changeSort, ...props }) => {
  const sorted = sortDeep(cards, primary, secondary);

  return (
    <div className="table-view-container">
      <Row className="table-view" {...props}>
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

const TableView = SortContext.Wrapped(TableViewRaw);

export default TableView;
