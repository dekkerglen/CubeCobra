import type { LegendItem } from 'chart.js';

import { dimHiddenLegendItems, fadeColor } from '../../src/components/analytics/chartLegend';

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
