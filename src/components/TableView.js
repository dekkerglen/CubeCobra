import React, { useEffect } from 'react';

import { Row, Col } from 'reactstrap';

import AutocardListGroup from './AutocardListGroup';
import SortContext from './SortContext';

const TableViewRaw = ({ cards, primary, secondary, tertiary, changeSort, ...props }) => {
  let columns = sortIntoGroups(cards, primary);
  let columnCounts = {};
  for (let columnLabel of Object.keys(columns)) {
    columnCounts[columnLabel] = columns[columnLabel].length;
    columns[columnLabel] = sortIntoGroups(columns[columnLabel], secondary);
  }

  return (
    <div className="table-view-container">
      <Row className="table-view" {...props}>
        {getLabels(primary)
          .filter((columnLabel) => columns[columnLabel])
          .map((columnLabel) => {
            let column = columns[columnLabel];
            return (
              <Col
                key={columnLabel}
                xs="6"
                md="3"
                lg="auto"
                className="mt-3 table-col"
                style={{ width: `${100 / Math.min(Object.keys(columns).length, 8)}%` }}
              >
                <h6 className="text-center">
                  {columnLabel}
                  <br />({columnCounts[columnLabel]})
                </h6>
                {getLabels(secondary)
                  .filter((label) => column[label])
                  .map((label) => (
                    <AutocardListGroup
                      key={label}
                      heading={`${label} (${column[label].length})`}
                      cards={column[label]}
                    />
                  ))}
              </Col>
            );
          })}
      </Row>
    </div>
  );
};

const TableView = SortContext.Wrapped(TableViewRaw);

export default TableView;
