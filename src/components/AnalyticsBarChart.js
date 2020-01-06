import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Col, Row } from 'reactstrap';

const AnalyticsBarChart = ({ data, title, ...props }) => {
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
            labelString: data['xAxisLabel'],
          },
        },
      ],
      yAxes: [
        {
          display: true,
          scaleLabel: {
            display: true,
            labelString: ['yAxisLabel'],
          },
        },
      ],
    },
  };

  return (
    <>
      <Row {...props}>
        <Col>
          <h4 className="d-lg-block d-none">{title}</h4>
          Click the labels to filter them out of the datasets.
        </Col>
      </Row>
      <Row>
        <Col>
          <Bar data={data['datasets']} options={options} />
        </Col>
      </Row>
    </>
  );
};

export default AnalyticsBarChart;
