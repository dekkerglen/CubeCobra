import React from 'react';

import { Col, Row, Table } from 'reactstrap';

const types = ['Creatures', 'Instants', 'Sorceries', 'Enchantments', 'Artifacts', 'Planeswalkers', 'Lands', 'Total'];

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
            {colors.map(([name, _, short]) => (
              <th key={name + 'col'} scope="col">
                {name === 'Total' ? (
                  'Total'
                ) : (
                  <img key={short} src={`/content/symbols/${short}.png`} alt={name} title={name} className="mana-symbol" />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="breakdown">
          {types.map((type) => (
            <tr key={type + 'row'}>
              <th scope="row">{type}</th>
              {colors.map(([name, path, _]) => {
                const reactKey = type + path;
                const count = typeByColor[type][path];
                const colorTotal = typeByColor['Total'][path];
                if (name !== 'Total' && path !== 'Total' && count > 1 && colorTotal > count) {
                  const percent = Math.round((count / colorTotal) * 100.0);
                  return (
                    <td key={reactKey}>
                      {count}
                      <span className="percent">{percent}%</span>
                    </td>
                  );
                } else {
                  return <td key={reactKey}>{count}</td>;
                }
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </Col>
  </Row>
);

export default TypeAnalysis;
