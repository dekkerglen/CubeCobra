import React, { useCallback, useMemo, useState } from 'react';
import { Col, Input, InputGroup, InputGroupText, Row, Spinner } from 'reactstrap';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Chart as ChartJS } from 'chart.js/auto';
import PropTypes from 'prop-types';
import { Chart } from 'react-chartjs-2';

import useQueryParam from 'hooks/useQueryParam';
import { csrfFetch } from 'utils/CSRF';
import { formatDate } from 'utils/Date';

const PlayRateGraph = ({ defaultHistories, cardId }) => {
  const [cubeType, setCubeType] = useQueryParam('cubeType', 'total');
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
          label: 'Percent',
          data: history.map((point) => {
            if (point[cubeType][1] === 0) {
              return 0;
            }
            return Math.round((point[cubeType][0] / point[cubeType][1]) * 10000) / 100;
          }),
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
  }, [history, cubeType]);

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
      <InputGroup className="mb-3">
        <InputGroupText>Cube type: </InputGroupText>
        <Input id="cubeType" type="select" value={cubeType} onChange={(event) => setCubeType(event.target.value)}>
          <option value="total">All</option>
          <option value="vintage">Vintage</option>
          <option value="legacy">Legacy</option>
          <option value="modern">Modern</option>
          <option value="peasant">Peasant</option>
          <option value="pauper">Pauper</option>
          <option value="size180">1-180 cards</option>
          <option value="size360">181-360 cards</option>
          <option value="size450">361-450 cards</option>
          <option value="size540">451-540 cards</option>
          <option value="size720">541+ cards</option>
        </Input>
      </InputGroup>
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
        <>{history.length > 0 ? <Chart options={options} data={data} type="line" /> : <p>No data available.</p>}</>
      )}
    </>
  );
};

PlayRateGraph.propTypes = {
  defaultHistories: PropTypes.arrayOf(PropTypes.shape({})),
  cardId: PropTypes.string.isRequired,
};

PlayRateGraph.defaultProps = {
  defaultHistories: [],
};

export default PlayRateGraph;
