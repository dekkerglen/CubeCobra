import React, { useMemo } from 'react';

import { Chart as ChartJS, LinearScale, PointElement, ScatterController, Tooltip, Legend, type ChartOptions } from 'chart.js';
import { Scatter } from 'react-chartjs-2';

import Text from '../base/Text';

ChartJS.register(LinearScale, PointElement, ScatterController, Tooltip, Legend);

export type DraftMapColorMode = 'cluster' | 'deckColor';

export interface DraftMapPoint {
  x: number;
  y: number;
  poolIndex: number;
  draftIndex: number;
  seatIndex: number;
  clusterId: number | null;
  clusterIndex: number | null;
  clusterLabel: string;
  archetype: string;
}

const MTG_COLORS: Record<string, { bg: string }> = {
  W: { bg: '#D8CEAB' },
  U: { bg: '#67A6D3' },
  B: { bg: '#8C7A91' },
  R: { bg: '#D85F69' },
  G: { bg: '#6AB572' },
  C: { bg: '#ADADAD' },
  M: { bg: '#DBC467' },
};

const CLUSTER_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ea580c',
  '#4f46e5',
];

function getColorProfileCodes(colorPair: string): string[] {
  const letters = colorPair.split('').filter((c) => c in MTG_COLORS && c !== 'C' && c !== 'M');
  return letters.length === 0 ? ['C'] : letters;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function archetypeToColor(archetype: string): string {
  const codes = getColorProfileCodes(archetype);
  if (codes.length === 1) return MTG_COLORS[codes[0]!]?.bg ?? MTG_COLORS.C!.bg;

  let r = 0;
  let g = 0;
  let b = 0;
  for (const code of codes) {
    const hex = (MTG_COLORS[code]?.bg ?? MTG_COLORS.C!.bg).replace('#', '');
    r += parseInt(hex.substring(0, 2), 16);
    g += parseInt(hex.substring(2, 4), 16);
    b += parseInt(hex.substring(4, 6), 16);
  }
  r = Math.round(r / codes.length);
  g = Math.round(g / codes.length);
  b = Math.round(b / codes.length);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const DraftMapScatter: React.FC<{
  points: DraftMapPoint[];
  selectedPoolIndex: number | null;
  activePoolIndexSet: Set<number> | null;
  colorMode: DraftMapColorMode;
  onSelectPoint: (point: DraftMapPoint) => void;
}> = ({ points, selectedPoolIndex, activePoolIndexSet, colorMode, onSelectPoint }) => {
  if (points.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        Draft map is unavailable for this run.
      </Text>
    );
  }

  const hasActiveFilter = activePoolIndexSet !== null;
  const isInActiveFilter = (point: DraftMapPoint) => !hasActiveFilter || activePoolIndexSet.has(point.poolIndex);
  const pointBaseColor = (point: DraftMapPoint) => {
    if (colorMode === 'deckColor') return archetypeToColor(point.archetype);
    return point.clusterIndex === null ? MTG_COLORS.C!.bg : CLUSTER_COLORS[point.clusterIndex % CLUSTER_COLORS.length]!;
  };
  const selectedPoint = useMemo(
    () => (selectedPoolIndex === null ? null : (points.find((point) => point.poolIndex === selectedPoolIndex) ?? null)),
    [points, selectedPoolIndex],
  );

  const data = useMemo(
    () => ({
      datasets: [
        {
          label: 'Draft decks',
          data: points,
          backgroundColor: points.map((point) => hexToRgba(pointBaseColor(point), isInActiveFilter(point) ? 0.9 : 0.15)),
          borderColor: 'transparent',
          borderWidth: 0,
          pointRadius: points.map((point) => (isInActiveFilter(point) ? 4 : 3)),
          pointHoverRadius: 7,
        },
        ...(selectedPoint
          ? [
              {
                label: 'Selected deck',
                data: [selectedPoint],
                backgroundColor: '#facc15',
                borderColor: '#111827',
                borderWidth: 2,
                pointRadius: 8,
                pointHoverRadius: 9,
              },
            ]
          : []),
      ],
    }),
    [points, selectedPoint, colorMode, activePoolIndexSet],
  );

  const options = useMemo<ChartOptions<'scatter'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      events: ['click'],
      onClick: (_event: unknown, elements: { datasetIndex: number; index: number }[]) => {
        const element = elements[0];
        if (!element) return;
        const point = element.datasetIndex === 1 ? selectedPoint : points[element.index];
        if (point) onSelectPoint(point);
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    }),
    [selectedPoint, points, onSelectPoint],
  );

  return (
    <Scatter
      data={data}
      options={options}
    />
  );
};

export default React.memo(DraftMapScatter);
