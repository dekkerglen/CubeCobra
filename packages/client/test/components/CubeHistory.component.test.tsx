import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import CubeHistory from 'components/cube/CubeHistory';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

jest.mock('components/blog/BlogPostChangelog', () => ({
  __esModule: true,
  default: () => <div>changelog</div>,
}));

const change = (index: number) => ({
  id: `c${index}`,
  cubeId: 'cube-1',
  date: 1700000000000 + index,
  changelog: { mainboard: {} },
});

const renderHistory = (props: React.ComponentProps<typeof CubeHistory>, csrfFetch = jest.fn()) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
      <CubeContext.Provider value={{ cube: { id: 'cube-1' } } as any}>
        <CubeHistory {...props} />
      </CubeContext.Provider>
    </CSRFContext.Provider>,
  );

describe('CubeHistory', () => {
  it('shows no pager for a cube with no changelog history', () => {
    renderHistory({ changes: [], lastKey: undefined });

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(screen.getAllByText('This cube has no history!').length).toBeGreaterThan(0);
  });

  it('shows no pager when nothing is loaded but a cursor remains', () => {
    renderHistory({ changes: [], lastKey: 'cursor' });

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it('renders the changes header with no loaded-record count', () => {
    renderHistory({ changes: [change(0), change(1)], lastKey: undefined });

    expect(screen.getByText('Changes')).toBeInTheDocument();
    expect(screen.queryByText(/Changes \(/)).not.toBeInTheDocument();
  });

  it('renders Page 1 with no denominator once more changes can be fetched', () => {
    renderHistory({ changes: Array.from({ length: 18 }, (_, index) => change(index)), lastKey: 'cursor' });

    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(screen.queryByText(/ of /i)).not.toBeInTheDocument();
  });
});
