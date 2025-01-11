import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  CategoryScale,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Line } from 'react-chartjs-2';
import History from '../../datatypes/History';

import { formatDate } from 'utils/Date';
import { Row, Col, Flexbox } from './base/Layout';
import Select from './base/Select';
import Spinner from './base/Spinner';
import Text from './base/Text';
import { CSRFContext } from '../contexts/CSRFContext';

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
        <>
          {history.length > 1 ? <Line options={options as any} data={data as any} /> : <Text>No data available.</Text>}
        </>
      )}
    </Flexbox>
  );
};

export default EloGraph;
