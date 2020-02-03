import React from 'react';
import { Col, Row, Table } from 'reactstrap';
import PropTypes from 'prop-types';

import MagicMarkdown from 'components/MagicMarkdown';

// Data should be:
// {
//   type: 'table',
//   description: str,
//   tables: [
//     {
//       headers: [
//         {
//           header: str, label for the column
//           key: str, key for values from this column in data
//           rowHeader: bool, whether this column is a header for the rows
//         }
//       ],
//       rows: [
//         {
//           [key]: str|float, value to show for column with key [key]
//         }
//       ],
//     },
//   ],
// }
const HeaderCell = ({ children, ...props }) => (
  <th scope="row" {...props}>
    {children}
  </th>
);
const RegularCell = ({ children, ...props }) => <td {...props}>{children}</td>;
RegularCell.propTypes = { children: PropTypes.node.isRequired };
HeaderCell.propTypes = { children: PropTypes.shape({}).isRequired };

const AnalyticsTable = ({ data }) => (
  <Row>
    {data.tables.map(({ columns, rows }, tablePosition) => (
      <Col key={/* eslint-disable-line react/no-array-index-key */ `table-${tablePosition}`}>
        <Table bordered responsive className="mt-lg-3">
          <thead>
            <tr>
              {columns.map(({ header, key }) => (
                <th key={`${key}-col`} scope="col">
                  <MagicMarkdown markdown={header} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="breakdown">
            {rows.map((datapoint, position) => (
              <tr key={/* eslint-disable-line react/no-array-index-key */ `row-${position}`}>
                {columns.map(({ key, rowHeader }) => {
                  let Cell;
                  if (rowHeader) {
                    Cell = HeaderCell;
                  } else {
                    Cell = RegularCell;
                  }
                  return (
                    <Cell key={/* eslint-disable-line react/no-array-index-key */ `${key}-${position}`}>
                      <MagicMarkdown markdown={String(datapoint[key])} />
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Col>
    ))}
  </Row>
);

AnalyticsTable.propTypes = {
  data: PropTypes.shape({
    tables: PropTypes.arrayOf(
      PropTypes.shape({
        columns: PropTypes.arrayOf(
          PropTypes.shape({
            header: PropTypes.string.isRequired,
            key: PropTypes.string.isRequired,
            rowHeader: PropTypes.bool,
          }),
        ),
        rows: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
      }),
    ),
  }).isRequired,
};

export default AnalyticsTable;
