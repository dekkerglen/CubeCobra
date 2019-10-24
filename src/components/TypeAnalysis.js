import React from 'react';

import { Col, Row, Table } from 'reactstrap';

const types = ['Creatures', 'Instants', 'Sorceries', 'Enchantments', 'Artifacts', 'Planeswalkers', 'Lands', 'Total']

const colors = [
  ['White', 'White', 'w'],
  ['Blue', 'Blue', 'u'],
  ['Black', 'Black', 'b'],
  ['Red', 'Red', 'r'],
  ['Green', 'Green', 'g'],
  ['Colorless', 'Colorless', 'c'],
  ['Multicolored', 'Multi', 'm'],
  ['Total', 'Total', 'Total'],
];

const TypeAnalysis = ({ typeByColor, ...props }) => (
  <Row {...props}>
    <Col>
      <h4 className="d-lg-block d-none">Type Breakdown</h4>
      <Table bordered responsive className="mt-lg-3">
        <thead>
          <tr>
            <th scope="col" />
            {colors.map(([name, _, short]) =>
              <th scope="col">
                {name === 'Total' ? 'Total' :
                  <img key={short} src={`/content/symbols/${short}.png`} alt={name} title={name} />
                }
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {types.map(type =>
            <tr>
              <th scope="row">{type}</th>
              {colors.map(([name, path, _]) =>
                <td>{typeByColor[type][path]}</td>
              )}
            </tr>
          )}
        </tbody>
      </Table>
    </Col>
  </Row>
);


export default TypeAnalysis;
