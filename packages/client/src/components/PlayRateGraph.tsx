import React, { useCallback, useContext, useMemo, useState } from 'react';

import History, { CubeType } from '@utils/datatypes/History';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import 'chartjs-adapter-date-fns';

import { formatDate } from 'utils/Date';

import { CSRFContext } from '../contexts/CSRFContext';
import useQueryParam from '../hooks/useQueryParam';
import { Col, Flexbox, Row } from './base/Layout';
import Select from './base/Select';
import Spinner from './base/Spinner';

interface PlayRateGraphProps {
  defaultHistories: History[];
  cardId: string;
}

// Register the necessary Chart.js components
ChartJS.register(CategoryScale, TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const PlayRateGraph: React.FC<PlayRateGraphProps> = ({ defaultHistories, cardId }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [cubeType, setCubeType] = useQueryParam('cubeType', 'total');
  const [history, setHistory] = useState<History[]>(defaultHistories);
  const [zoom, setZoom] = useState('year');
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState<boolean>(false);

  const type: CubeType = cubeType as CubeType;

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
            if ((point[type]?.[1] ?? 0) === 0) {
              return 0;
            }
            return point[type] ? Math.round((point[type][0] / point[type][1]) * 10000) / 100 : 0;
          }),
        },
      ],
    };

    const yRange = [
      Math.min(...plot.datasets[0].data.map((point) => point as number)),
      Math.max(...plot.datasets[0].data.map((point) => point as number)),
    ];

    return {
      options: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        },
        responsive: true,
        hover: {
          mode: 'nearest',
          intersect: true,
        },
        scales: {
          x: {
            distribution: 'linear',
            time: {
              unit: 'day',
            },
            ticks: {
              min: plot.datasets[0].data[0] as number,
              max: plot.datasets[0].data[plot.datasets[0].data.length - 1] as number,
            },
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Percent',
            },
            ticks: yRange ? { min: yRange[0], max: yRange[1] } : {},
          },
        },
      },
      data: plot,
    };
  }, [history, cubeType]);

  const updateZoomAndPeriod = useCallback(
    async (newZoom: string, newPeriod: string) => {
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
    <Flexbox direction="col" gap="2">
      <Select
        label="Cube type"
        id="cubeType"
        value={type}
        setValue={(c) => setCubeType(c)}
        options={[
          { value: 'total', label: 'All' },
          { value: 'vintage', label: 'Vintage' },
          { value: 'legacy', label: 'Legacy' },
          { value: 'modern', label: 'Modern' },
          { value: 'peasant', label: 'Peasant' },
          { value: 'pauper', label: 'Pauper' },
          { value: 'size180', label: '1-180 cards' },
          { value: 'size360', label: '181-360 cards' },
          { value: 'size450', label: '361-450 cards' },
          { value: 'size540', label: '451-540 cards' },
          { value: 'size720', label: '541+ cards' },
        ]}
      />
      <Row>
        <Col xs={12} md={6}>
          <Select
            label="Period"
            id="period"
            value={period}
            setValue={(p) => updateZoomAndPeriod(zoom, p)}
            options={[
              { value: 'month', label: 'Month' },
              { value: 'week', label: 'Week' },
              { value: 'day', label: 'Day' },
            ]}
          />
        </Col>
        <Col xs={12} md={6}>
          <Select
            label="Zoom"
            id="zoom"
            value={zoom}
            setValue={(z) => updateZoomAndPeriod(z, period)}
            options={[
              { value: 'month', label: 'Month' },
              { value: 'year', label: 'Year' },
              { value: 'all', label: 'All-Time' },
            ]}
          />
        </Col>
      </Row>
      {loading ? (
        <div className="centered">
          <Spinner lg />
        </div>
      ) : (
        <>{history.length > 1 ? <Line options={options as any} data={data as any} /> : <p>No data available.</p>}</>
      )}
    </Flexbox>
  );
};

export default PlayRateGraph;
