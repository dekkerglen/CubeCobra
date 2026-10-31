import type { Chart, LegendItem } from 'chart.js';

import {
  barLegendLabels,
  dimHiddenLegendItems,
  dimmedLegendLabels,
  doughnutLegendLabels,
  fadeColor,
} from '../../src/components/analytics/chartLegend';

const item = (overrides: Partial<LegendItem> = {}) =>
  ({
    text: 'Blue',
    fillStyle: '#67A6D3',
    // Deliberately different from fillStyle, so the hollow-swatch test proves the ring
    // takes the series colour rather than merely preserving the original stroke.
    strokeStyle: '#000000',
    fontColor: '#666666',
    lineWidth: 0,
    hidden: false,
    datasetIndex: 0,
    ...overrides,
  }) as LegendItem;

describe('fadeColor', () => {
  it('fades a six-digit hex toward the background', () => {
    expect(fadeColor('#667788', 0.45)).toBe('rgba(102, 119, 136, 0.45)');
  });

  it('expands a three-digit hex', () => {
    expect(fadeColor('#666', 0.45)).toBe('rgba(102, 102, 102, 0.45)');
  });

  it('falls back to the Chart.js default colour when none is given', () => {
    expect(fadeColor(undefined, 0.45)).toBe('rgba(102, 102, 102, 0.45)');
  });

  it('returns a colour it cannot parse unchanged rather than emitting NaN', () => {
    expect(fadeColor('currentColor', 0.45)).toBe('currentColor');
  });
});

describe('dimHiddenLegendItems', () => {
  it('leaves a visible item untouched', () => {
    const visible = item();

    expect(dimHiddenLegendItems([visible])[0]).toEqual(visible);
  });

  it('hollows the swatch of a hidden item', () => {
    const [dimmed] = dimHiddenLegendItems([item({ hidden: true })]);

    expect(dimmed.fillStyle).toBe('transparent');
    expect(dimmed.strokeStyle).toBe('#67A6D3');
    expect(dimmed.lineWidth).toBe(2);
  });

  it('fades the label text of a hidden item', () => {
    const [dimmed] = dimHiddenLegendItems([item({ hidden: true })]);

    expect(dimmed.fontColor).toBe('rgba(102, 102, 102, 0.45)');
  });

  it('preserves fields it does not own', () => {
    const [dimmed] = dimHiddenLegendItems([item({ hidden: true })]);

    expect(dimmed.text).toBe('Blue');
    expect(dimmed.datasetIndex).toBe(0);
    expect(dimmed.hidden).toBe(true);
  });
});

describe('dimmedLegendLabels', () => {
  it('omits generateLabels when the base generator is missing, so Chart.js keeps its own', () => {
    expect(dimmedLegendLabels(undefined)).toEqual({});
  });

  it('pipes the base generator through the dimming when one is available', () => {
    const labels = dimmedLegendLabels(() => [item({ hidden: true })]);

    expect(labels.generateLabels!({} as Chart)[0].fillStyle).toBe('transparent');
  });
});

// Minimal stand-ins shaped to what Chart.js's own label generators read, so the wrappers actually run
// against the installed version rather than being asserted by identity alone.
const barChart = (hiddenDataset: number) =>
  ({
    data: { datasets: [{ label: 'Blue' }, { label: 'Red' }] },
    legend: { options: { labels: {} } },
    _getSortedDatasetMetas: () =>
      ['#67A6D3', '#D85F69'].map((backgroundColor, index) => ({
        index,
        visible: index !== hiddenDataset,
        controller: { getStyle: () => ({ backgroundColor, borderColor: '#000000', borderWidth: 0 }) },
      })),
  }) as unknown as Chart;

const doughnutChart = (hiddenSlice: number) =>
  ({
    data: { labels: ['White', 'Blue'], datasets: [{}] },
    legend: { options: { labels: {} } },
    getDatasetMeta: () => ({
      controller: {
        getStyle: (i: number) => ({
          backgroundColor: ['#D8CEAB', '#67A6D3'][i],
          borderColor: '#FFFFFF',
          borderWidth: 1,
        }),
      },
    }),
    getDataVisibility: (i: number) => i !== hiddenSlice,
  }) as unknown as Chart;

describe('the generators wired into the At a Glance charts', () => {
  it('dims a hidden dataset on a Chart.js bar legend', () => {
    const items = barLegendLabels.generateLabels!(barChart(1));

    expect(items.map((i) => i.text)).toEqual(['Blue', 'Red']);
    expect(items[0].fillStyle).toBe('#67A6D3');
    expect(items[1].fillStyle).toBe('transparent');
    expect(items[1].strokeStyle).toBe('#D85F69');
  });

  // Production sets no legend label colour, so items arrive with fontColor undefined.
  it('falls back to the Chart.js default colour when the legend sets none', () => {
    const items = barLegendLabels.generateLabels!(barChart(1));

    expect(items[1].fontColor).toBe('rgba(102, 102, 102, 0.45)');
  });

  it('labels each slice rather than each dataset on a Chart.js doughnut legend', () => {
    const items = doughnutLegendLabels.generateLabels!(doughnutChart(1));

    expect(items.map((i) => i.text)).toEqual(['White', 'Blue']);
    expect(items[1].fillStyle).toBe('transparent');
    expect(items[1].strokeStyle).toBe('#67A6D3');
  });
});
