import type { Chart } from 'chart.js';

import { makeDoughnutOptions } from '../../src/components/draftSimulator/SimulatorCharts';

// Minimal stand-in shaped to what the simulator's own generateLabels reads.
const chartWithHiddenSlice = (hiddenSlice: number) =>
  ({
    data: {
      labels: ['White', 'Blue'],
      datasets: [{ data: [60, 40], backgroundColor: ['#D8CEAB', '#67A6D3'] }],
    },
    getDataVisibility: (i: number) => i !== hiddenSlice,
  }) as unknown as Chart;

const labelsOf = (hiddenSlice: number) =>
  (makeDoughnutOptions('#FFFFFF') as any).plugins.legend.labels.generateLabels(chartWithHiddenSlice(hiddenSlice));

describe('draft simulator doughnut legend', () => {
  it('still labels each slice with its share', () => {
    expect(labelsOf(1).map((item: any) => item.text)).toEqual(['White  60%', 'Blue  40%']);
  });

  it('reports a toggled-off slice as hidden so Chart.js strikes its label through', () => {
    expect(labelsOf(1)[1].hidden).toBe(true);
    expect(labelsOf(1)[0].hidden).toBe(false);
  });

  it('hollows the swatch of a toggled-off slice', () => {
    const [, hidden] = labelsOf(1);

    expect(hidden.fillStyle).toBe('transparent');
    expect(hidden.strokeStyle).toBe('#67A6D3');
  });

  it('leaves a visible slice fully filled', () => {
    const [visible] = labelsOf(1);

    expect(visible.fillStyle).toBe('#D8CEAB');
  });
});
