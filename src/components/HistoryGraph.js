import React from 'react';
import PropTypes from 'prop-types';
import ChartComponent from 'react-chartjs-2';
import CardHistoryPropType from 'proptypes/CardHistoryPropType';

const formatDate = (date) => `${date.getDate()}-${date.getMonth()}-${date.getFullYear()}`;

const distinct = (list) => {
  const res = [];
  const dates = new Set();
  for (const item of list) {
    const date = formatDate(item.x);
    if (!dates.has(date)) {
      res.push(item);
      dates.add(date);
    }
  }
  if (res.length > 0 && !dates.has(formatDate(new Date()))) {
    res.push({
      x: new Date(),
      y: res[res.length - 1].y,
    });
  }
  return res;
};

const Graph = ({ data, yFunc, unit, yRange }) => {
  const plot = {
    labels: [unit],
    datasets: [
      {
        lineTension: 0,
        pointRadius: 0,
        fill: false,
        borderColor: '#28A745',
        backgroundColor: '#28A745',
        data: distinct(
          data
            .map((point) => {
              try {
                return { x: new Date(point.date), y: yFunc(point.data) };
              } catch (exc) {
                return {}; // if the yFunc fails this will get filtered out
              }
            })
            .filter((point) => point.y),
        ),
      },
    ],
  };

  let options = {};

  if (plot.datasets[0].data.length > 0) {
    options = {
      legend: {
        display: false,
      },
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
            type: 'time',
            distribution: 'linear',
            time: {
              unit: 'day',
            },
            ticks: {
              min: plot.datasets[0].data[0].x,
            },
          },
        ],
        yAxes: [
          {
            display: true,
            scaleLabel: {
              display: true,
              labelString: unit,
            },
            ticks: yRange ? { min: yRange[0], max: yRange[1] } : {},
          },
        ],
      },
    };
  }

  if (plot.datasets[0].data.length > 0) {
    return <ChartComponent options={options} data={plot} type="line" />;
  }
  return <p>No data to show.</p>;
};

Graph.propTypes = {
  data: CardHistoryPropType.isRequired,
  yFunc: PropTypes.func.isRequired,
  unit: PropTypes.string.isRequired,
  yRange: PropTypes.arrayOf(PropTypes.number),
};

Graph.defaultProps = {
  yRange: null,
};

export default Graph;
