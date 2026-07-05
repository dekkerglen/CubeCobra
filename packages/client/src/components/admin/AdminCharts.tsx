import React from 'react';

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const PALETTE = ['#67A6D3', '#6AB572', '#D85F69', '#DBC467', '#8C7A91', '#D8CEAB', '#5FA8A0', '#C98B5E'];

export const colorForIndex = (index: number): string => PALETTE[index % PALETTE.length];

// Semantic colors for HTTP status buckets: 2xx green, 3xx blue, 4xx amber, 5xx red.
export const statusColor = (status: string): string => {
  const first = status.trim().charAt(0);
  switch (first) {
    case '2':
      return '#6AB572';
    case '3':
      return '#67A6D3';
    case '4':
      return '#DBC467';
    case '5':
      return '#D85F69';
    default:
      return '#ADADAD';
  }
};

// Formats a bucket timestamp (epoch ms) into a compact axis label. Short windows show
// just the time; longer ones include the date.
export const formatBucketLabel = (t: number, windowMinutes: number): string => {
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (windowMinutes <= 1440) {
    return `${hh}:${mm}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
};

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

interface ChartCardProps {
  labels: string[];
  datasets: ChartDataset[];
  height?: number;
  stacked?: boolean;
}

const baseOptions = (stacked: boolean) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { display: true, position: 'bottom' as const, labels: { boxWidth: 12 } },
  },
  scales: {
    x: { stacked, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
    y: { stacked, beginAtZero: true },
  },
});

export const LineChart: React.FC<ChartCardProps> = ({ labels, datasets, height = 240 }) => {
  const data = {
    labels,
    datasets: datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color ?? colorForIndex(i),
      backgroundColor: ds.color ?? colorForIndex(i),
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.25,
    })),
  };
  return (
    <div style={{ height }}>
      <Line options={baseOptions(false) as any} data={data} />
    </div>
  );
};

export const StackedBarChart: React.FC<ChartCardProps> = ({ labels, datasets, height = 240 }) => {
  const data = {
    labels,
    datasets: datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ds.color ?? colorForIndex(i),
    })),
  };
  return (
    <div style={{ height }}>
      <Bar options={baseOptions(true) as any} data={data} />
    </div>
  );
};
