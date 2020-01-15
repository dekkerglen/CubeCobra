import React from 'react';

import { Col, Row, Table } from 'reactstrap';

import MagicMarkdown from './MagicMarkdown';

// Data should be:
// {
//   type: 'table',
//   description: str,
//   headers: [
//     {
//       header: str, label for the column
//       key: str, key for values from this column in data
//       rowHeader: bool, whether this column is a header for the rows
//     }
//   ],
//   rows: [
//     {
//       [key]: str|float, value to show for column with key [key]
//     }
//   ],
// }
const AnalyticsTable = ({ data, ...props }) => (
  <Row>
    <Col>
      <Table bordered responsive className="mt-lg-3">
        <thead>
          <tr>
            {data.columns.map(({ header, key }) => (
              <th key={`${key}-col`} scope="col">
                <MagicMarkdown markdown={header} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="breakdown">
          {data.data.map((datapoint, position) => (
            <tr key={`${position}-row`}>
              {data.columns.map(({ key, rowHeader }, columnPosition) => {
                var Cell = ({ children, ...props }) => <td {...props}>{children}</td>;
                if (rowHeader)
                  Cell = ({ children, ...props }) => (
                    <th scope="row" {...props}>
                      {children}
                    </th>
                  );
                return (
                  <Cell key={`${key}-${position}`}>
                    <MagicMarkdown markdown={datapoint[key]} />
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </Col>
  </Row>
);

export default AnalyticsTable;
