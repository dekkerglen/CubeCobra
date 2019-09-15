import React from 'react';

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
    <Row {...props} style={{ ...props.style, margin: '0 -2px' }}>
      {
        getLabels(primary).filter(columnLabel => columns[columnLabel]).map(columnLabel => {
          let column = columns[columnLabel];
          return (
            <Col key={columnLabel} xs="6" md="3" lg="auto" className="mt-3" style={{ padding: '0 2px', width: `${100 / Math.min(Object.keys(columns).length, 8)}%` }}>
              <h6 className="text-center">{columnLabel}<br />({columnCounts[columnLabel]})</h6>
              {
                getLabels(secondary).filter(label => column[label]).map(label =>
                  <AutocardListGroup
                    key={label}
                    heading={`${label} (${column[label].length})`}
                    cards={column[label]}
                    primary={columnLabel}
                    secondary={label}
                  />
                )
            }
            </Col>
          );
        }
        )
      }
    </Row>
  );
}

const TableView = SortContext.Wrapped(TableViewRaw);

export default TableView;
