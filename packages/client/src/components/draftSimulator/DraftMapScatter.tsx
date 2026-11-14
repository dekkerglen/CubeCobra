import React, { useMemo } from 'react';

import {
  Chart as ChartJS,
  type ChartOptions,
  Legend,
  LinearScale,
  type Plugin,
  PointElement,
  ScatterController,
  Tooltip,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';

import Text from '../base/Text';

ChartJS.register(LinearScale, PointElement, ScatterController, Tooltip, Legend);

export type DraftMapColorMode = 'cluster' | 'deckColor' | 'archetype';

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
  // Index of the deck's archetype name, for archetype coloring; null when it has none.
  archetypeIndex?: number | null;
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
  const letters = colorPair
    .split('')
    .filter((c) => Object.prototype.hasOwnProperty.call(MTG_COLORS, c) && c !== 'C' && c !== 'M');
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

// Deck-color mode: each deck is a pie with one equal slice per color, in full-strength mana colors.
const MANA_COLORS: Record<string, string> = {
  W: '#FCF4D6',
  U: '#2F80ED',
  B: '#1E1E1E',
  R: '#E5383B',
  G: '#2EAE4F',
  C: '#A8A8A8',
};
// Keeps black slices visible on the dark theme and white ones on the light theme.
const SLICE_OUTLINE = '#9CA3AF';

// A legend swatch drawn like a deck-color dot: one slice per color code.
export const ColorPieSwatch: React.FC<{ codes: string[]; size?: number }> = ({ codes, size = 12 }) => {
  const fills = getColorProfileCodes(codes.join('')).map((code) => MANA_COLORS[code]!);
  const r = size / 2 - 0.5;
  const c = size / 2;
  const at = (angle: number) => `${c + r * Math.cos(angle)} ${c + r * Math.sin(angle)}`;
  const step = (2 * Math.PI) / fills.length;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {fills.length === 1 ? (
        <circle cx={c} cy={c} r={r} fill={fills[0]} />
      ) : (
        fills.map((fill, i) => {
          const start = -Math.PI / 2 + i * step;
          return <path key={i} d={`M ${c} ${c} L ${at(start)} A ${r} ${r} 0 0 1 ${at(start + step)} Z`} fill={fill} />;
        })
      )}
      <circle cx={c} cy={c} r={r} fill="none" stroke={SLICE_OUTLINE} strokeWidth={1} />
    </svg>
  );
};

interface ColorSlices {
  fills: string[];
  outline: string;
}

// Chart.js leaves deck-color dots transparent; this paints each one as its pie of color slices.
const colorSlicesPlugin: Plugin<'scatter'> = {
  id: 'deckColorSlices',
  afterDatasetDraw: (chart, { index, meta }) => {
    const slices = (chart.data.datasets[index] as { colorSlices?: ColorSlices[] }).colorSlices;
    if (!slices) return;
    const { ctx } = chart;
    meta.data.forEach((element, i) => {
      const slice = slices[i];
      if (!slice) return;
      const { x, y } = element.getProps(['x', 'y']) as { x: number; y: number };
      const radius = (element.options as { radius: number }).radius;
      const step = (2 * Math.PI) / slice.fills.length;
      ctx.save();
      slice.fills.forEach((fill, c) => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, radius, -Math.PI / 2 + c * step, -Math.PI / 2 + (c + 1) * step);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      });
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = slice.outline;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    });
  },
};

const DraftMapScatter: React.FC<{
  points: DraftMapPoint[];
  selectedPoolIndex: number | null;
  activePoolIndexSet: Set<number> | null;
  colorMode: DraftMapColorMode;
  onSelectPoint: (point: DraftMapPoint) => void;
  /** Radius of an active dot. Inactive = baseRadius-1, selected = baseRadius+4. Defaults to 4. */
  baseRadius?: number;
}> = ({ points, selectedPoolIndex, activePoolIndexSet, colorMode, onSelectPoint, baseRadius = 4 }) => {
  const hasActiveFilter = activePoolIndexSet !== null;
  const isInActiveFilter = (point: DraftMapPoint) => !hasActiveFilter || activePoolIndexSet.has(point.poolIndex);
  const pointBaseColor = (point: DraftMapPoint) => {
    if (colorMode === 'archetype') {
      const slot = point.archetypeIndex ?? null;
      return slot === null ? MTG_COLORS.C!.bg : CLUSTER_COLORS[slot % CLUSTER_COLORS.length]!;
    }
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
          backgroundColor: points.map((point) =>
            colorMode === 'deckColor'
              ? 'transparent'
              : hexToRgba(pointBaseColor(point), isInActiveFilter(point) ? 0.9 : 0.15),
          ),
          colorSlices:
            colorMode === 'deckColor'
              ? points.map((point): ColorSlices => {
                  const alpha = isInActiveFilter(point) ? 0.9 : 0.15;
                  return {
                    fills: getColorProfileCodes(point.archetype).map((code) => hexToRgba(MANA_COLORS[code]!, alpha)),
                    outline: hexToRgba(SLICE_OUTLINE, alpha),
                  };
                })
              : undefined,
          borderColor: 'transparent',
          borderWidth: 0,
          pointRadius: points.map((point) => (isInActiveFilter(point) ? baseRadius : Math.max(1, baseRadius - 1))),
          pointHoverRadius: baseRadius + 3,
        },
        ...(selectedPoint
          ? [
              {
                label: 'Selected deck',
                data: [selectedPoint],
                backgroundColor: '#facc15',
                borderColor: '#111827',
                borderWidth: 2,
                pointRadius: baseRadius + 4,
                pointHoverRadius: baseRadius + 5,
              },
            ]
          : []),
      ],
    }),
    // isInActiveFilter / pointBaseColor are inlined-closure helpers derived from
    // these inputs; listing the inputs is what actually drives invalidation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (points.length === 0) {
    return (
      <Text sm className="text-text-secondary">
        Draft map is unavailable for this run.
      </Text>
    );
  }

  return <Scatter data={data} options={options} plugins={[colorSlicesPlugin]} />;
};

export default React.memo(DraftMapScatter);
