import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import CubeContext from 'contexts/CubeContext';

import AtAGlance from '../../src/analytics/AtAGlance';

jest.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="bar" />,
  Doughnut: () => <div data-testid="doughnut" />,
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
