import React from 'react';

import { Row, Col } from 'reactstrap';

import AutocardListGroup from './AutocardListGroup';

const TableView = ({ cards, ...props }) => {
  sorts[0] = document.getElementById('primarySortSelect').value || 'Color Category';
  sorts[1] = document.getElementById('secondarySortSelect').value || 'Types-Multicolor';
  let columns = sortIntoGroups(cards, sorts[0]);
  let columnCounts = {};
  for (let columnLabel of Object.keys(columns)) {
    columnCounts[columnLabel] = columns[columnLabel].length;
    columns[columnLabel] = sortIntoGroups(columns[columnLabel], sorts[1]);
  }

  return (
    <Row {...props} style={{ ...props.style, margin: '0 -2px' }}>
      {
        getLabels(sorts[0]).filter(columnLabel => columns[columnLabel]).map(columnLabel => {
          let column = columns[columnLabel];
          return (
            <Col key={columnLabel} xs="6" md="3" lg="auto" style={{ padding: '0 2px', width: `${100 / Math.min(Object.keys(columns).length, 8)}%` }}>
              <h6 className="text-center">{columnLabel}<br />({columnCounts[columnLabel]})</h6>
              {
                getLabels(sorts[1]).filter(label => column[label]).map(label =>
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

export default TableView;
