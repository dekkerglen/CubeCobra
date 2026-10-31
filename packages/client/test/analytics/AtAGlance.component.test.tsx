import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import CubeContext from 'contexts/CubeContext';

import AtAGlance from '../../src/analytics/AtAGlance';
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
    elo: 1200,
    ...overrides,
  },
});

const renderGlance = (cards = [card('a')]) =>
  render(
    <CubeContext.Provider
      value={{ cube: { id: 'c1', name: 'T', priceVisibility: 'nu' }, changedCards: { mainboard: cards } } as any}
    >
      <AtAGlance tokenMap={{}} cubeAnalytics={{}} />
    </CubeContext.Provider>,
  );

// The ⓘ is a `span.ml-1` nested inside the chart title; hovering it reveals the tooltip body.
const hoverInfo = (title: string) => fireEvent.mouseOver(screen.getByText(title).querySelector('span.ml-1')!);

// Bar charts render in a fixed order: Mana Curve, Original Release Year, Elo, Word Count,
// Popularity, Price.
const RELEASE_YEAR_BAR = 1;

beforeEach(() => {
  mockBarProps.length = 0;
  mockDoughnutProps.length = 0;
});

describe('At a Glance printing-basis tooltips', () => {
  it('says Price Distribution uses the cube’s printings, not the cheapest', () => {
    renderGlance();
    hoverInfo('Price Distribution');

    expect(screen.getByText(/printing and finish/i)).toBeInTheDocument();
    expect(screen.getByText(/not the cheapest printing/i)).toBeInTheDocument();
  });

  it('says Rarity Breakdown uses the cube’s printings and honours overrides', () => {
    renderGlance();
    hoverInfo('Rarity Breakdown');

    expect(screen.getByText(/reprinted at a different rarity/i)).toBeInTheDocument();
    expect(screen.getByText(/override takes precedence/i)).toBeInTheDocument();
  });
});

describe('At a Glance release year axis', () => {
  it('starts at 1993 even when the cube holds only modern cards', () => {
    renderGlance([card('a', { firstPrintYear: 2010 })]);

    const labels = mockBarProps[RELEASE_YEAR_BAR].data.labels;

    expect(labels[0]).toBe('1993');
    expect(labels[labels.length - 1]).toBe(String(new Date().getFullYear()));
  });

  it('keeps one bar per year rather than grouping them', () => {
    renderGlance([card('a', { firstPrintYear: 2010 })]);

    const labels: string[] = mockBarProps[RELEASE_YEAR_BAR].data.labels;

    expect(labels.every((label) => /^\d{4}$/.test(label))).toBe(true);
    expect(labels).toHaveLength(new Date().getFullYear() - 1993 + 1);
  });
});

describe('At a Glance legend hidden state', () => {
  const MANA_CURVE_BAR = 0;

  it('gives the Mana Curve legend the dimming label generator', () => {
    renderGlance();

    expect(mockBarProps[MANA_CURVE_BAR].options.plugins.legend.labels.generateLabels).toBe(
      barLegendLabels.generateLabels,
    );
  });

  it('gives every donut the per-slice dimming label generator', () => {
    renderGlance();

    expect(mockDoughnutProps).not.toHaveLength(0);
    for (const props of mockDoughnutProps) {
      expect(props.options.plugins.legend.labels.generateLabels).toBe(doughnutLegendLabels.generateLabels);
    }
  });
});
