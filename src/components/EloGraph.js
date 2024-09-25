import React, { useCallback, useMemo, useState } from 'react';
import { Col, Input, InputGroup, InputGroupText, Row, Spinner } from 'reactstrap';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Chart as ChartJS } from 'chart.js/auto';
import PropTypes from 'prop-types';
import { Chart } from 'react-chartjs-2';

import { csrfFetch } from 'utils/CSRF';
import { formatDate } from 'utils/Date';

const EloGraph = ({ defaultHistories, cardId }) => {
  const [history, setHistory] = useState(defaultHistories);
  const [zoom, setZoom] = useState('year');
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState(false);

  const { options, data } = useMemo(() => {
    if (history.length === 0) {
      return {
        options: {},
        data: {},
      };
    }

    const plot = {
      labels: history.map((point) => formatDate(new Date(point.date))),
      datasets: [
        {
          lineTension: 0,
          pointRadius: 0,
          fill: false,
          borderColor: '#28A745',
          backgroundColor: '#28A745',
          label: 'Elo',
          data: history.map((point) => point.elo || 1200),
        },
      ],
    };

    const yRange = [
      Math.min(...plot.datasets[0].data.map((point) => point.y)),
      Math.max(...plot.datasets[0].data.map((point) => point.y)),
    ];

    return {
      options: {
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
                max: plot.datasets[0].data[plot.datasets[0].data.length - 1].x,
              },
            },
          ],
          yAxes: [
            {
              display: true,
              scaleLabel: {
                display: true,
                labelString: 'Percent',
              },
              ticks: yRange ? { min: yRange[0], max: yRange[1] } : {},
            },
          ],
        },
      },
      data: plot,
    };
  }, [history]);

  const updateZoomAndPeriod = useCallback(
    async (newZoom, newPeriod) => {
      setZoom(newZoom);
      setPeriod(newPeriod);
      setLoading(true);

      const response = await csrfFetch(`/tool/cardhistory`, {
        method: 'POST',
        body: JSON.stringify({
          id: cardId,
          zoom: newZoom,
          period: newPeriod,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const json = await response.json();

      setHistory(json.data);
      setLoading(false);
    },
    [cardId, setZoom, setPeriod],
  );

  return (
    <>
      <Row>
        <Col xs="12" md="6">
          <InputGroup className="mb-3">
            <InputGroupText>Period: </InputGroupText>
            <Input
              id="period"
              type="select"
              value={period}
              onChange={(event) => updateZoomAndPeriod(zoom, event.target.value)}
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </Input>
          </InputGroup>
        </Col>
        <Col xs="12" md="6">
          <InputGroup className="mb-3">
            <InputGroupText>Zoom: </InputGroupText>
            <Input
              id="zoom"
              type="select"
              value={zoom}
              onChange={(event) => updateZoomAndPeriod(event.target.value, period)}
            >
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="all">All-Time</option>
            </Input>
          </InputGroup>
        </Col>
      </Row>
      {loading ? (
        <div className="d-flex justify-content-center">
          <Spinner />
        </div>
      ) : (
        <>{history.length > 1 ? <Chart options={options} data={data} type="line" /> : <p>No data available.</p>}</>
      )}
    </>
  );
};

EloGraph.propTypes = {
  defaultHistories: PropTypes.arrayOf(PropTypes.shape({})),
  cardId: PropTypes.string.isRequired,
};

EloGraph.defaultProps = {
  defaultHistories: [],
};

export default EloGraph;
