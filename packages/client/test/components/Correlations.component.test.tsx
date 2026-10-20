import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CardDetails } from '@utils/datatypes/Card';

import Correlations from 'components/cardPage/Correlations';
import { CSRFContext } from 'contexts/CSRFContext';

// Card grids pull in user context, drag handling, and image loading; none of
// that is relevant to when the combos request fires.
jest.mock('components/card/CardGrid', () => ({
  __esModule: true,
  default: () => <div data-testid="card-grid" />,
}));

jest.mock('components/cardPage/CombosContent', () => ({
  __esModule: true,
  default: ({ combo }: { combo: { id: string } }) => <div>{`combo-${combo.id}`}</div>,
}));

const emptyBucket = { top: [], creatures: [], spells: [], other: [] } as {
  top: CardDetails[];
  creatures: CardDetails[];
  spells: CardDetails[];
  other: CardDetails[];
};

const renderCorrelations = (csrfFetch: jest.Mock) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: '', csrfFetch, callApi: jest.fn() }}>
      <Correlations draftedWith={emptyBucket} cubedWith={emptyBucket} synergistic={emptyBucket} oracleId="oracle-123" />
    </CSRFContext.Provider>,
  );

describe('Correlations combos tab', () => {
  it('does not request combos until the tab is opened', () => {
    const csrfFetch = jest.fn();

    renderCorrelations(csrfFetch);

    expect(csrfFetch).not.toHaveBeenCalled();
  });

  it('shows a loading state as soon as the tab is opened', () => {
    // A promise that never settles, so the tab stays in its pending state.
    const csrfFetch = jest.fn().mockReturnValue(new Promise(() => {}));

    renderCorrelations(csrfFetch);
    fireEvent.click(screen.getByRole('button', { name: 'Combos' }));

    // Must not flash "No combos found" before the request resolves.
    expect(screen.getByText('Loading combos…')).toBeInTheDocument();
    expect(screen.queryByText('No combos found.')).not.toBeInTheDocument();
    expect(csrfFetch).toHaveBeenCalledTimes(1);
    expect(csrfFetch).toHaveBeenCalledWith('/tool/api/getcardcombos', expect.anything());
  });

  it('renders combos once the request resolves', async () => {
    const csrfFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ combos: [{ id: 'abc' }] }),
    });

    renderCorrelations(csrfFetch);
    fireEvent.click(screen.getByRole('button', { name: 'Combos' }));

    await waitFor(() => expect(screen.getByText('combo-abc')).toBeInTheDocument());
    expect(screen.getByText('1 combos found.')).toBeInTheDocument();
  });

  it('requests combos only once across repeated tab switches', async () => {
    const csrfFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ combos: [] }),
    });

    renderCorrelations(csrfFetch);
    fireEvent.click(screen.getByRole('button', { name: 'Combos' }));
    await waitFor(() => expect(screen.getByText('No combos found.')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Often Drafted With' }));
    fireEvent.click(screen.getByRole('button', { name: 'Combos' }));

    expect(csrfFetch).toHaveBeenCalledTimes(1);
  });
});
