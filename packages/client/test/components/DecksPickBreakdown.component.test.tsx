import React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import DecksPickBreakdown from '../../src/components/DecksPickBreakdown';

jest.mock('components/draft/DraftBreakdownDisplay', () => (props: any) => (
  <div>
    <span data-testid="show-ratings">{String(props.showRatings)}</span>
    <button onClick={() => props.setShowRatings(false)}>turn off ratings</button>
  </div>
));

const DRAFT_ID = 'draft-1';
const STORAGE_KEY = `showDraftRatings-${DRAFT_ID}`;

const createDraft = () =>
  ({
    id: DRAFT_ID,
    cards: [{ details: { oracle_id: 'o1' } }, { details: { oracle_id: 'o2' } }],
    DraftmancerLog: { players: [[{ pick: 0, booster: [0, 1] }]] },
  }) as any;

// The component fetches bot predictions on mount; flush that promise so its
// setRatings lands inside act() rather than after the test ends.
const renderBreakdown = async () => {
  const result = render(<DecksPickBreakdown draft={createDraft()} seatNumber={0} />);
  await act(async () => {});
  return result;
};

describe('DecksPickBreakdown ratings toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ prediction: [] }) }) as any;
  });

  it('shows ratings by default', async () => {
    await renderBreakdown();

    expect(screen.getByTestId('show-ratings')).toHaveTextContent('true');
  });

  it('ignores a persisted toggle value from a previous session', async () => {
    localStorage.setItem(STORAGE_KEY, 'false');

    await renderBreakdown();

    expect(screen.getByTestId('show-ratings')).toHaveTextContent('true');
  });

  it('does not persist the toggle when it is turned off', async () => {
    await renderBreakdown();

    fireEvent.click(screen.getByRole('button', { name: 'turn off ratings' }));

    await waitFor(() => expect(screen.getByTestId('show-ratings')).toHaveTextContent('false'));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
