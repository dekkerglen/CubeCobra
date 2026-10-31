import React from 'react';

import { render } from '@testing-library/react';

import '@testing-library/jest-dom';

import CubeContext from 'contexts/CubeContext';

import ChartComponent from '../../src/analytics/Chart';
import Keywords from '../../src/analytics/Keywords';
import Prices from '../../src/analytics/Prices';
import { barLegendLabels, doughnutLegendLabels } from '../../src/components/analytics/chartLegend';

// Charts are canvas-rendered, so the mock stands in for them and records what they were handed.
const mockBarProps: any[] = [];
const mockDoughnutProps: any[] = [];

jest.mock('react-chartjs-2', () => ({
  Bar: (props: any) => {
    mockBarProps.push(props);
    return <div data-testid="bar" />;
  },
  Doughnut: (props: any) => {
    mockDoughnutProps.push(props);
    return <div data-testid="doughnut" />;
  },
}));

// Keywords pulls in Markdown, whose github-slugger dependency is ESM-only and unloadable here.
jest.mock('../../src/components/Markdown', () => () => <div data-testid="markdown" />);

// The word cloud's d3-cloud layout needs a real canvas. It is irrelevant to legend wiring, so stub
// the chainable builder and have it place nothing.
jest.mock('d3-cloud', () => () => {
  const layout: any = { start: () => {}, stop: () => {} };
  for (const method of ['size', 'words', 'padding', 'rotate', 'font', 'fontSize', 'spiral', 'on']) {
    layout[method] = () => layout;
  }
  return layout;
});

const card = (id: string, overrides = {}) => ({
  cardID: id,
  index: 0,
  board: 'mainboard',
  details: {
    name: id,
    colors: ['U'],
    type: 'Creature',
    cmc: 2,
    color_identity: ['U'],
    rarity: 'rare',
    prices: { usd: 1.5 },
    firstPrintYear: 2001,
    oracle_text: 'Flying',
    keywords: ['Flying'],
    elo: 1200,
    ...overrides,
  },
});

const renderInCube = (ui: React.ReactElement) =>
  render(
    <CubeContext.Provider
      value={
        {
          cube: { id: 'c1', name: 'T', formats: [], defaultFormat: -1 },
          changedCards: { mainboard: [card('a'), card('b')] },
        } as any
      }
    >
      {ui}
    </CubeContext.Provider>,
  );

const characteristics = {
  'Mana Value': {
    labels: () => ['1', '2'],
    cardIsLabel: (c: any, label: string) => String(c.details.cmc) === label,
  },
};

// Keywords' word cloud measures itself; jsdom has no ResizeObserver.
beforeAll(() => {
  (globalThis as any).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  mockBarProps.length = 0;
  mockDoughnutProps.length = 0;
  window.history.replaceState({}, '', '/cube/analysis/c1');
});

const everyGenerator = (props: any[]) => props.map((p) => p.options?.plugins?.legend?.labels?.generateLabels);

describe('Chart view legend', () => {
  it('dims hidden series on the configurable stacked bar', () => {
    renderInCube(<ChartComponent characteristics={characteristics} />);

    expect(everyGenerator(mockBarProps)).toEqual([barLegendLabels.generateLabels]);
  });
});

describe('Keywords view legends', () => {
  it('dims hidden series on the stacked keyword bar', () => {
    renderInCube(<Keywords />);

    expect(everyGenerator(mockBarProps)).toContain(barLegendLabels.generateLabels);
  });

  it('dims hidden slices on the color weight donut', () => {
    renderInCube(<Keywords />);

    expect(everyGenerator(mockDoughnutProps)).toContain(doughnutLegendLabels.generateLabels);
  });
});

describe('Prices view legends', () => {
  it('dims hidden slices on every donut', () => {
    renderInCube(<Prices />);

    const generators = everyGenerator(mockDoughnutProps);

    expect(generators).not.toHaveLength(0);
    expect(generators.every((g) => g === doughnutLegendLabels.generateLabels)).toBe(true);
  });
});
