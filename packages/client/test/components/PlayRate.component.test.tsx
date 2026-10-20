import React from 'react';

import { render, screen, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import HistoryType from '@utils/datatypes/History';

import PlayRate from 'components/cardPage/PlayRate';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

jest.mock('components/PlayRateGraph', () => ({
  __esModule: true,
  default: () => <div data-testid="play-rate-graph" />,
}));

const card = getPlaceholderCardDetails('scryfall-id');

// Legacy rows written before pioneer existed simply omit that key,
// so the component has to tell "no cubes recorded" apart from "0% play rate".
const createHistory = (overrides?: Partial<HistoryType>): HistoryType =>
  ({
    OTComp: 'oracle-123:week',
    oracle: 'oracle-123',
    date: new Date('2026-10-11').valueOf(),
    picks: 0,
    cubes: 0,
    vintage: [50, 200],
    legacy: [10, 40],
    modern: [6, 30],
    pioneer: [2, 25],
    peasant: [3, 60],
    pauper: [4, 80],
    size180: [5, 100],
    size360: [6, 100],
    size450: [7, 100],
    size540: [8, 100],
    size720: [9, 100],
    total: [50, 200],
    cubeCount: [50, 200],
    ...overrides,
  }) as HistoryType;

const rowFor = (label: string) => screen.getByText(label).closest('tr') as HTMLElement;

describe('PlayRate by legality', () => {
  it('renders a row for every tracked format, including Pioneer', () => {
    const history = [createHistory({ date: 1 }), createHistory()];

    render(<PlayRate card={card} history={history} />);

    expect(within(rowFor('Vintage')).getByText('25.00%')).toBeInTheDocument();
    expect(within(rowFor('Legacy')).getByText('25.00%')).toBeInTheDocument();
    expect(within(rowFor('Modern')).getByText('20.00%')).toBeInTheDocument();
    expect(within(rowFor('Pioneer')).getByText('8.00%')).toBeInTheDocument();
    expect(within(rowFor('Peasant')).getByText('5.00%')).toBeInTheDocument();
    expect(within(rowFor('Pauper')).getByText('5.00%')).toBeInTheDocument();
  });

  it('shows "No data" rather than 0.00% when a bucket has no recorded cubes', () => {
    const history = [
      createHistory({ date: 1 }),
      createHistory({ pioneer: undefined, legacy: [0, 0], modern: [0, 30] }),
    ];

    render(<PlayRate card={card} history={history} />);

    expect(within(rowFor('Pioneer')).getByText('No data')).toBeInTheDocument();
    expect(within(rowFor('Legacy')).getByText('No data')).toBeInTheDocument();
    // A real zero out of a non-empty denominator is still a meaningful 0.00%.
    expect(within(rowFor('Modern')).getByText('0.00%')).toBeInTheDocument();
  });

  it('reports the most recent entry', () => {
    const history = [createHistory({ date: 1, pioneer: [25, 25] }), createHistory({ pioneer: [5, 25] })];

    render(<PlayRate card={card} history={history} />);

    expect(within(rowFor('Pioneer')).getByText('20.00%')).toBeInTheDocument();
  });
});
