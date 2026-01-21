import React, { useCallback, useContext, useMemo, useState } from 'react';

import { DefaultElo } from '@utils/datatypes/Card';
import History from '@utils/datatypes/History';
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
import { Col, Flexbox, Row } from './base/Layout';
import Select from './base/Select';
import Spinner from './base/Spinner';
import Text from './base/Text';

interface EloGraphProps {
  defaultHistories: History[];
  cardId: string;
}

// Register the necessary Chart.js components
ChartJS.register(CategoryScale, TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const EloGraph: React.FC<EloGraphProps> = ({ defaultHistories, cardId }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [history, setHistory] = useState<History[]>(defaultHistories);
  const [zoom, setZoom] = useState<string>('year');
  const [period, setPeriod] = useState<string>('week');
  const [loading, setLoading] = useState<boolean>(false);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true); // Assume there's older data initially

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
          data: history.map((point) => point.elo || DefaultElo),
        },
      ],
    };

    const yRange = [
      Math.min(...plot.datasets[0].data.map((point) => point as number)),
      Math.max(...plot.datasets[0].data.map((point) => point as number)),
    ];

    return {
      options: {
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            mode: 'nearest',
            intersect: false,
          },
        },
        responsive: true,
        hover: {
          mode: 'index',
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
  }, [history]);

  const fetchHistory = useCallback(
    async (newZoom: string, newPeriod: string, newOffset: number = 0) => {
      setLoading(true);

      const response = await csrfFetch(`/tool/cardhistory`, {
        method: 'POST',
        body: JSON.stringify({
          id: cardId,
          zoom: newZoom,
          period: newPeriod,
          offset: newOffset,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const json = await response.json();

      setHistory(json.data);
      setHasMore(json.hasMore || false);
      setLoading(false);
    },
    [csrfFetch, cardId],
  );

  const updateZoomAndPeriod = useCallback(
    async (newZoom: string, newPeriod: string) => {
      setZoom(newZoom);
      setPeriod(newPeriod);
      setOffset(0);
      await fetchHistory(newZoom, newPeriod, 0);
    },
    [fetchHistory],
  );

  const handlePagination = useCallback(
    async (direction: 'prev' | 'next') => {
      const zoomMap: Record<string, Record<string, number>> = {
        month: { day: 30, week: 4, month: 2 },
        year: { day: 365, week: 52, month: 12 },
      };
      const step = zoomMap[zoom]?.[period] || 0;
      // Previous goes to older data (increase offset), Next goes to newer data (decrease offset)
      const newOffset = direction === 'prev' ? offset + step : Math.max(0, offset - step);
      setOffset(newOffset);
      await fetchHistory(zoom, period, newOffset);
    },
    [zoom, period, offset, fetchHistory],
  );

  const timeRange = useMemo(() => {
    if (history.length < 2) return '';
    const start = new Date(history[0].date);
    const end = new Date(history[history.length - 1].date);
    return `${formatDate(start)} - ${formatDate(end)}`;
  }, [history]);

  return (
    <Flexbox direction="col" gap="2">
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
      {zoom !== 'all' && (
        <Flexbox direction="row" justify="between" alignItems="center" className="px-2">
          <button
            onClick={() => handlePagination('prev')}
            disabled={!hasMore || loading}
            className="px-3 py-1 bg-button-primary text-button-text rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <Text sm className="text-text-secondary">
            {timeRange}
          </Text>
          <button
            onClick={() => handlePagination('next')}
            disabled={offset === 0 || loading}
            className="px-3 py-1 bg-button-primary text-button-text rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </Flexbox>
      )}
      {loading ? (
        <div className="centered">
          <Spinner lg />
        </div>
      ) : (
        <>
          {history.length > 1 ? <Line options={options as any} data={data as any} /> : <Text>No data available.</Text>}
        </>
      )}
    </Flexbox>
  );
};

export default EloGraph;
