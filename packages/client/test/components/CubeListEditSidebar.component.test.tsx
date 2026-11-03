import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card from '@utils/datatypes/Card';
import { DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';

import CubeListEditSidebar from 'components/cube/CubeListEditSidebar';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import { trackEvent } from 'utils/analytics';

jest.mock('utils/analytics', () => ({ trackEvent: jest.fn() }));
// TextEntry pulls in the ESM-only syntax highlighter, which this test has no use for.
jest.mock('components/TextEntry', () => ({ __esModule: true, default: () => null }));

const mockTrackEvent = trackEvent as jest.Mock;

const CUBE_ID = 'cube-1';

const makeCard = (index: number, board: string, oracleId: string): Card =>
  ({
    index,
    board,
    cardID: `card-${board}-${index}`,
    details: { oracle_id: oracleId, name: `Card ${oracleId}` },
  }) as Card;

const renderSidebar = ({
  isHorizontal = false,
  changedCards,
  unfilteredChangedCards = changedCards,
  bulkRemoveCard = jest.fn(),
}: {
  isHorizontal?: boolean;
  changedCards: Record<string, Card[]>;
  unfilteredChangedCards?: Record<string, Card[]>;
  bulkRemoveCard?: jest.Mock;
}) => {
  const cubeValue = {
    cube: {
      id: CUBE_ID,
      cards: unfilteredChangedCards,
      defaultPrinting: 'recent',
      defaultStatus: 'Not Owned',
      boards: [
        { name: 'Mainboard', id: 'mainboard' },
        { name: 'Maybeboard', id: 'maybeboard' },
      ],
    },
    changes: { version: 0 },
    changedCards,
    unfilteredChangedCards,
    addCard: jest.fn(),
    removeCard: jest.fn(),
    swapCard: jest.fn(),
    bulkRemoveCard,
    clearChanges: jest.fn(),
    commitChanges: jest.fn(),
    alerts: [],
    setAlerts: jest.fn(),
    loading: false,
    useBlog: false,
    setUseBlog: jest.fn(),
  };

  return render(
    <CSRFContext.Provider value={{ csrfToken: 't', csrfFetch: jest.fn(), callApi: jest.fn() } as any}>
      <DisplayContextProvider cubeID={CUBE_ID} savedDisplayOptions={DEFAULT_CUBE_DISPLAY_OPTIONS}>
        <CubeContext.Provider value={cubeValue as any}>
          <CubeListEditSidebar isHorizontal={isHorizontal} />
        </CubeContext.Provider>
      </DisplayContextProvider>
    </CSRFContext.Provider>,
  );
};

describe('CubeListEditSidebar cleanup dropdown', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  // What the active filter leaves on screen: two copies of "dup", plus one card that also
  // sits on the maybeboard.
  const changedCards = {
    mainboard: [makeCard(0, 'mainboard', 'dup'), makeCard(1, 'mainboard', 'dup'), makeCard(2, 'mainboard', 'shared')],
    maybeboard: [makeCard(0, 'maybeboard', 'shared')],
  };

  /*
   * A strict superset of the above: the filter hides a third "dup" and a second "shared" on the
   * mainboard, and a "dup" on the maybeboard. Cleanup must see none of them — on the target board
   * or the reference board — so every count below changes if a memo reads this list instead.
   */
  const unfilteredChangedCards = {
    mainboard: [
      ...changedCards.mainboard,
      makeCard(3, 'mainboard', 'dup'),
      makeCard(4, 'mainboard', 'shared'),
      makeCard(5, 'mainboard', 'hidden-only'),
    ],
    maybeboard: [...changedCards.maybeboard, makeCard(1, 'maybeboard', 'dup')],
  };

  it.each([
    ['vertical', false],
    ['horizontal', true],
  ])('renders the cleanup dropdown in the %s layout', (_name, isHorizontal) => {
    renderSidebar({ isHorizontal, changedCards, unfilteredChangedCards });

    fireEvent.click(screen.getByText('Cleanup'));

    expect(screen.getByText('Remove Duplicates (1)')).toBeInTheDocument();
    expect(screen.getByText('Remove cards also in…')).toBeInTheDocument();
    expect(screen.getByText('Maybeboard (1)')).toBeInTheDocument();
  });

  /*
   * Cleanup is filter-scoped on both the target and the reference board: it must read
   * changedCards, never unfilteredChangedCards. Pointing any of the three cleanup memos at the
   * unfiltered list changes a count here — duplicates would read 2, the maybeboard item 3 if the
   * reference board went unfiltered, or 2 if the target board did.
   */
  it('counts and stages only cards the active filter leaves visible, on both boards', () => {
    const bulkRemoveCard = jest.fn();
    renderSidebar({ changedCards, unfilteredChangedCards, bulkRemoveCard });

    fireEvent.click(screen.getByText('Cleanup'));

    expect(screen.getByText('Remove Duplicates (1)')).toBeInTheDocument();
    expect(screen.getByText('Maybeboard (1)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Remove Duplicates (1)'));
    expect(bulkRemoveCard.mock.calls[0][0]).toEqual([{ index: 1, board: 'mainboard' }]);

    fireEvent.click(screen.getByText('Maybeboard (1)'));
    expect(bulkRemoveCard.mock.calls[1][0]).toEqual([{ index: 2, board: 'mainboard' }]);
  });

  /*
   * The displayed board and the Board select can disagree — a view spanning several boards
   * defaults the select to the first one — so an unlabelled menu leaves the user reading
   * "Mainboard (3)" while looking at the mainboard and assuming it describes what's on screen.
   */
  it('names the board it is about to clean, by label rather than board key', () => {
    renderSidebar({ changedCards, unfilteredChangedCards });

    fireEvent.click(screen.getByText('Cleanup'));

    expect(screen.getByText(/^Cleaning/)).toHaveTextContent('Cleaning Mainboard');
  });

  it('omits the board being edited from the "also in" list', () => {
    renderSidebar({ changedCards, unfilteredChangedCards });

    fireEvent.click(screen.getByText('Cleanup'));

    expect(screen.queryByText(/^Mainboard \(/)).not.toBeInTheDocument();
  });

  it('stages exactly the removals the duplicates count advertises', () => {
    const bulkRemoveCard = jest.fn();
    renderSidebar({ changedCards, unfilteredChangedCards, bulkRemoveCard });

    fireEvent.click(screen.getByText('Cleanup'));
    fireEvent.click(screen.getByText('Remove Duplicates (1)'));

    expect(bulkRemoveCard).toHaveBeenCalledTimes(1);
    expect(bulkRemoveCard.mock.calls[0][0]).toEqual([{ index: 1, board: 'mainboard' }]);
    expect(mockTrackEvent).toHaveBeenCalledWith('cube_cleanup_duplicates', { count: 1, board: 'mainboard' });
  });

  it('stages exactly the removals the overlap count advertises', () => {
    const bulkRemoveCard = jest.fn();
    renderSidebar({ changedCards, unfilteredChangedCards, bulkRemoveCard });

    fireEvent.click(screen.getByText('Cleanup'));
    fireEvent.click(screen.getByText('Maybeboard (1)'));

    expect(bulkRemoveCard).toHaveBeenCalledTimes(1);
    expect(bulkRemoveCard.mock.calls[0][0]).toEqual([{ index: 2, board: 'mainboard' }]);
    expect(mockTrackEvent).toHaveBeenCalledWith('cube_cleanup_overlap', {
      count: 1,
      board: 'mainboard',
      otherBoard: 'maybeboard',
    });
  });

  it('disables items with nothing to remove, and opening the menu alone stages nothing', () => {
    const bulkRemoveCard = jest.fn();
    renderSidebar({
      changedCards: { mainboard: [makeCard(0, 'mainboard', 'solo')], maybeboard: [] },
      bulkRemoveCard,
    });

    fireEvent.click(screen.getByText('Cleanup'));

    const duplicates = screen.getByText('Remove Duplicates (0)');
    const overlap = screen.getByText('Maybeboard (0)');
    expect(duplicates).toBeDisabled();
    expect(overlap).toBeDisabled();
    expect(bulkRemoveCard).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
