import React from 'react';

import { Col, Row, Table } from 'reactstrap';

const white = ['White', 'w'];
const blue = ['Blue', 'u'];
const black = ['Black', 'b'];
const red = ['Red', 'r'];
const green = ['Green', 'g'];

const gold = [
  [
    '2 Color',
    [
      ['Azorius', [white, blue]],
      ['Dimir', [blue, black]],
      ['Rakdos', [black, red]],
      ['Gruul', [red, green]],
      ['Selesnya', [green, white]],
      ['Orzhov', [white, black]],
      ['Izzet', [red, blue]],
      ['Golgari', [green, black]],
      ['Boros', [red, white]],
      ['Simic', [green, blue]],
    ],
  ],
  [
    '3 Color',
    [
      ['Abzan', [white, black, green]],
      ['Bant', [white, blue, green]],
      ['Esper', [white, blue, black]],
      ['Grixis', [blue, black, red]],
      ['Jeskai', [white, blue, red]],
      ['Jund', [black, red, green]],
      ['Mardu', [white, black, red]],
      ['Naya', [white, red, green]],
      ['Sultai', [blue, black, green]],
      ['Temur', [blue, red, green]],
    ],
  ],
  [
    '4-5 Color',
    [
      ['NonWhite', [blue, black, red, green]],
      ['NonBlue', [blue, red, green, white]],
      ['NonBlack', [red, green, white, blue]],
      ['NonRed', [green, white, blue, black]],
      ['NonGreen', [white, blue, black, red]],
      ['FiveColor', [white, blue, black, red, green]],
    ],
  ],
];

const MulticoloredAnalysis = ({ multicoloredCounts, ...props }) => (
  <Row {...props}>
    {gold.map(([numColors, combos]) => (
      <Col key={numColors} xs="12" sm="6" md="auto">
        <Table bordered>
          <thead>
            <tr>
              <th>{numColors}</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {combos.map(([name, colors]) => (
              <tr key={name}>
                <td>
                  {colors.map((color) => (
                    <img key={color[0]} src={`/content/symbols/${color[1]}.png`} alt={color[0]} title={name} />
                  ))}
                </td>
                <td>{multicoloredCounts[name]}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Col>
    ))}
  </Row>
);

export default MulticoloredAnalysis;
