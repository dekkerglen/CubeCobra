import React from 'react';
import { Bar } from 'react-chartjs-2';

import { Col, Row } from 'reactstrap';

const CurveAnalysis = ({ curve, ...props }) => {
  const data = {
    labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9+'],
    datasets: [
      ['White', curve.white, '#D8CEAB'],
      ['Blue', curve.blue, '#67A6D3'],
      ['Black', curve.black, '#8C7A91'],
      ['Red', curve.red, '#D85F69'],
      ['Green', curve.green, '#6AB572'],
      ['Colorless', curve.colorless, '#ADADAD'],
      ['Multicolored', curve.multi, '#DBC467'],
      ['Total', curve.total, '#000000'],
    ].map((color) => ({
      label: color[0],
      data: color[1],
      fill: false,
      backgroundColor: color[2],
      borderColor: color[2],
    })),
  };

  const options = {
    responsive: true,
    tooltips: {
      mode: 'index',
      intersect: false,
    },
    hover: {
      mode: 'nearest',
      intersect: true,
    },
    scales: {
      xAxes: [
        {
          display: true,
          scaleLabel: {
            display: true,
            labelString: 'CMC',
          },
        },
      ],
      yAxes: [
        {
          display: true,
          scaleLabel: {
            display: true,
            labelString: 'Count',
          },
        },
      ],
    },
  };

  return (
    <div {...props}>
      <Row>
        <Col>
          <h4 className="d-lg-block d-none">Curve</h4>
          Click the labels to filter the datasets. Lands are omitted for the curve chart.
        </Col>
      </Row>
      <Row className="mt-2">
        <Col>
          <Bar data={data} options={options} />
        </Col>
      </Row>
    </div>
  );
};

export default CurveAnalysis;
