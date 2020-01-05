import React from 'react';

import { Col, Row, Table } from 'reactstrap';

import MagicMarkdown from './MagicMarkdown';

const AnalyticsTable = ({ data, title, ...props }) => {
  return (
    <>
      <Row {...props}>
        <Col>
          <h4 className="d-lg-block d-none">{title}</h4>
        </Col>
      </Row>
      <Row {...props}>
        <Col>
          <Table bordered responsive className="mt-lg-3">
            <thead>
              <tr>
                {data.columns.map(({ header, key }) => (
                  <th key={key + 'col'} scope="col">
                    <MagicMarkdown markdown={header} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="breakdown">
              {data.data.map((datapoint) => (
                <tr key={datapoint.key}>
                  {data.columns.map(({ key }) => {
                    const reactKey = datapoint.key + key;
                    return (
                      <td key={reactKey}>
                        <MagicMarkdown markdown={datapoint[key]} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Table>
        </Col>
      </Row>
    </>
  );
};

export default AnalyticsTable;
