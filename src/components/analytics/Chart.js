import React, { useState } from 'react';
import ChartComponent from 'react-chartjs-2';
import { Col, Row } from 'reactstrap';
import PropTypes from 'prop-types';

// Data should be:
// {
//   type: 'chart',
//   description: str,
//   chartType: 'doughnut'|'pie'|'line'|'bar'|'horizontalBar'|'radar'|'polarArea'|'bubble'|'scatter'
//   datasets: [], data field of Chart
//   options: [], options field of Chart
// }
// See https://github.com/jerairrest/react-chartjs-2 for more information.
const Chart = ({ data }) => (
  <Row>
    <ChartComponent options={data.options} data={data.datasets} type={data.chartType} />
  </Row>
);

Chart.propTypes = {
  data: PropTypes.shape({
    options: PropTypes.shape({}),
    datasets: PropTypes.shape({}).isRequired,
    chartType: PropTypes.string.isRequired,
  }).isRequired,
};

export default Chart;
