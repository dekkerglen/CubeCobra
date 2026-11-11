import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card, { CardDetails } from '@utils/datatypes/Card';
import { DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';

import CubeListEditSidebar from 'components/cube/CubeListEditSidebar';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import { trackEvent } from 'utils/analytics';
import { getPrintings } from 'utils/cards/getPrintings';

jest.mock('utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('utils/cards/getPrintings');
// TextEntry pulls in the ESM-only syntax highlighter, which this test has no use for.
jest.mock('components/TextEntry', () => ({ __esModule: true, default: () => null }));

const mockTrackEvent = trackEvent as jest.Mock;
const mockGetPrintings = getPrintings as jest.Mock;

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
  bulkEditPrinting = jest.fn(),
}: {
  isHorizontal?: boolean;
  changedCards: Record<string, Card[]>;
  unfilteredChangedCards?: Record<string, Card[]>;
  bulkRemoveCard?: jest.Mock;
  bulkEditPrinting?: jest.Mock;
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
    bulkEditPrinting,
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

describe('CubeListEditSidebar cleanup modal', () => {
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
   * mainboard, and a "dup" on the maybeboard. Cleanup must see none of them, on any checked
   * board, so every count below changes if a memo reads this list instead.
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
  ])('opens the cleanup modal from the %s layout', (_name, isHorizontal) => {
    renderSidebar({ isHorizontal, changedCards, unfilteredChangedCards });

    fireEvent.click(screen.getByText('Cleanup'));

    expect(screen.getByText('Remove Duplicates (1)')).toBeInTheDocument();
    expect(screen.getByText('Remove Cards (1)')).toBeInTheDocument();
  });

  /*
   * The displayed board and the Board select can disagree — a view spanning several boards
   * defaults the select to the first one — so the modal names the board it acts on, starting
   * from the edited one.
   */
  it('starts on the edited board, comparing it with the next board', () => {
    renderSidebar({ changedCards, unfilteredChangedCards });

    fireEvent.click(screen.getByText('Cleanup'));

    expect(screen.getByRole('combobox', { name: 'Board' })).toHaveValue('mainboard');
    expect(screen.getByRole('combobox', { name: 'Remove cards also in' })).toHaveValue('maybeboard');
    expect(screen.getByText("Removes every card in Mainboard that's also in Maybeboard.")).toBeInTheDocument();
  });

  it('offers every board but the cleaned one under "also in", each with its count', () => {
    renderSidebar({ changedCards, unfilteredChangedCards });

    fireEvent.click(screen.getByText('Cleanup'));

    const reference = screen.getByRole('combobox', { name: 'Remove cards also in' });
    expect([...reference.querySelectorAll('option')].map((option) => option.textContent)).toEqual(['Maybeboard (1)']);
  });

  /*
   * Cleanup is filter-scoped on both the cleaned and the reference board: it must read
   * changedCards, never unfilteredChangedCards. Pointing either cleanup at the unfiltered list
   * changes a count here — duplicates would read 2, the overlap 3 if the reference board went
   * unfiltered, or 2 if the cleaned board did.
   */
  it('counts and stages only cards the active filter leaves visible, on both boards', async () => {
    const bulkRemoveCard = jest.fn();
    renderSidebar({ changedCards, unfilteredChangedCards, bulkRemoveCard });

    fireEvent.click(screen.getByText('Cleanup'));

    expect(screen.getByText('Remove Duplicates (1)')).toBeInTheDocument();
    expect(screen.getByText('Remove Cards (1)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Remove Duplicates (1)'));
    expect(bulkRemoveCard.mock.calls[0][0]).toEqual([{ index: 1, board: 'mainboard' }]);

    await waitFor(() => expect(screen.queryByText('Remove Cards (1)')).not.toBeInTheDocument());
    fireEvent.click(screen.getByText('Cleanup'));
    fireEvent.click(screen.getByText('Remove Cards (1)'));
    expect(bulkRemoveCard.mock.calls[1][0]).toEqual([{ index: 2, board: 'mainboard' }]);
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

  it('stages exactly the removals the "also in" count advertises', () => {
    const bulkRemoveCard = jest.fn();
    renderSidebar({ changedCards, unfilteredChangedCards, bulkRemoveCard });

    fireEvent.click(screen.getByText('Cleanup'));
    fireEvent.click(screen.getByText('Remove Cards (1)'));

    expect(bulkRemoveCard).toHaveBeenCalledTimes(1);
    expect(bulkRemoveCard.mock.calls[0][0]).toEqual([{ index: 2, board: 'mainboard' }]);
    expect(mockTrackEvent).toHaveBeenCalledWith('cube_cleanup_overlap', {
      count: 1,
      board: 'mainboard',
      otherBoard: 'maybeboard',
    });
  });

  it('cleans the board picked in the modal, and starts over from the edited board when reopened', async () => {
    const bulkRemoveCard = jest.fn();
    renderSidebar({
      changedCards: {
        mainboard: [makeCard(0, 'mainboard', 'shared')],
        maybeboard: [
          makeCard(0, 'maybeboard', 'maybe-dup'),
          makeCard(1, 'maybeboard', 'maybe-dup'),
          makeCard(2, 'maybeboard', 'shared'),
        ],
      },
      bulkRemoveCard,
    });

    fireEvent.click(screen.getByText('Cleanup'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Board' }), { target: { value: 'maybeboard' } });

    expect(screen.getByRole('combobox', { name: 'Remove cards also in' })).toHaveValue('mainboard');
    expect(screen.getByText("Removes every card in Maybeboard that's also in Mainboard.")).toBeInTheDocument();
    expect(screen.getByText('Remove Cards (1)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Remove Duplicates (1)'));

    expect(bulkRemoveCard.mock.calls[0][0]).toEqual([{ index: 1, board: 'maybeboard' }]);
    expect(mockTrackEvent).toHaveBeenCalledWith('cube_cleanup_duplicates', { count: 1, board: 'maybeboard' });

    await waitFor(() => expect(screen.queryByText('Remove Duplicates (1)')).not.toBeInTheDocument());
    fireEvent.click(screen.getByText('Cleanup'));

    expect(screen.getByRole('combobox', { name: 'Board' })).toHaveValue('mainboard');
  });

  it('disables removals with nothing to remove, and opening the modal alone stages nothing', () => {
    const bulkRemoveCard = jest.fn();
    renderSidebar({
      changedCards: { mainboard: [makeCard(0, 'mainboard', 'solo')], maybeboard: [] },
      bulkRemoveCard,
    });

    fireEvent.click(screen.getByText('Cleanup'));

    expect(screen.getByText('Remove Duplicates (0)')).toBeDisabled();
    expect(screen.getByText('Remove Cards (0)')).toBeDisabled();
    expect(bulkRemoveCard).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('closes the modal once a removal is staged', async () => {
    renderSidebar({ changedCards, unfilteredChangedCards });

    fireEvent.click(screen.getByText('Cleanup'));
    fireEvent.click(screen.getByText('Remove Duplicates (1)'));

    await waitFor(() => expect(screen.queryByText('Remove Duplicates (1)')).not.toBeInTheDocument());
  });

  describe('Update Printings', () => {
    const newPrinting = { scryfall_id: 'new-printing', set: 'new', collector_number: '9' } as CardDetails;

    const openPrintingsTab = () => {
      fireEvent.click(screen.getByText('Cleanup'));
      fireEvent.click(screen.getByText('Update Printings'));
    };

    it('asks about the visible cards only, at the cube default printing, and only once the tab opens', async () => {
      mockGetPrintings.mockResolvedValue({});
      renderSidebar({ changedCards, unfilteredChangedCards });

      fireEvent.click(screen.getByText('Cleanup'));
      expect(mockGetPrintings).not.toHaveBeenCalled();

      fireEvent.click(screen.getByText('Update Printings'));

      await screen.findByText('Update Printings (0)');
      expect(mockGetPrintings).toHaveBeenCalledTimes(1);
      expect(mockGetPrintings.mock.calls[0][1]).toBe('recent');
      expect(mockGetPrintings.mock.calls[0][2]).toEqual(['card-mainboard-0', 'card-mainboard-1', 'card-mainboard-2']);
    });

    it('starts with only the edited board checked, and starts over when reopened', async () => {
      mockGetPrintings.mockResolvedValue({});
      renderSidebar({ changedCards, unfilteredChangedCards });

      openPrintingsTab();
      await screen.findByText('Update Printings (0)');

      expect(screen.getByRole('checkbox', { name: 'Mainboard' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Maybeboard' })).not.toBeChecked();

      fireEvent.click(screen.getByRole('checkbox', { name: 'Maybeboard' }));
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByText(/^Update Printings \(/)).not.toBeInTheDocument());

      fireEvent.click(screen.getByText('Cleanup'));
      expect(screen.getByRole('checkbox', { name: 'Maybeboard' })).not.toBeChecked();
    });

    it('asks again for every checked board when another is checked', async () => {
      mockGetPrintings.mockResolvedValue({});
      renderSidebar({ changedCards, unfilteredChangedCards });

      openPrintingsTab();
      await screen.findByText('Update Printings (0)');

      fireEvent.click(screen.getByRole('checkbox', { name: 'Maybeboard' }));

      await waitFor(() => expect(mockGetPrintings).toHaveBeenCalledTimes(2));
      expect(mockGetPrintings.mock.calls[1][2]).toEqual([
        'card-mainboard-0',
        'card-mainboard-1',
        'card-mainboard-2',
        'card-maybeboard-0',
      ]);
    });

    it('stages exactly the moves the count advertises', async () => {
      mockGetPrintings.mockResolvedValue({ 'card-mainboard-2': newPrinting });
      const bulkEditPrinting = jest.fn();
      renderSidebar({ changedCards, unfilteredChangedCards, bulkEditPrinting });

      openPrintingsTab();
      fireEvent.click(await screen.findByText('Update Printings (1)'));

      expect(bulkEditPrinting).toHaveBeenCalledTimes(1);
      expect(bulkEditPrinting.mock.calls[0][0]).toEqual([{ index: 2, board: 'mainboard', details: newPrinting }]);
      expect(mockTrackEvent).toHaveBeenCalledWith('cube_cleanup_printings', {
        count: 1,
        board: 'mainboard',
        printing: 'recent',
      });
    });

    it('asks again when another printing is picked', async () => {
      mockGetPrintings.mockResolvedValue({});
      renderSidebar({ changedCards, unfilteredChangedCards });

      openPrintingsTab();
      await screen.findByText('Update Printings (0)');

      mockGetPrintings.mockResolvedValue({ 'card-mainboard-0': newPrinting });
      fireEvent.change(screen.getByRole('combobox', { name: 'Printing' }), { target: { value: 'cheapest' } });

      await screen.findByText('Update Printings (1)');
      expect(mockGetPrintings.mock.calls[1][1]).toBe('cheapest');
    });

    it('disables the update while loading and when the request fails', async () => {
      mockGetPrintings.mockResolvedValue(null);
      const bulkEditPrinting = jest.fn();
      renderSidebar({ changedCards, unfilteredChangedCards, bulkEditPrinting });

      openPrintingsTab();

      expect(screen.getByText('Update Printings (0)')).toBeDisabled();
      await screen.findByText('Failed to load printings.');
      expect(screen.getByText('Update Printings (0)')).toBeDisabled();
      expect(bulkEditPrinting).not.toHaveBeenCalled();
    });
  });
});
