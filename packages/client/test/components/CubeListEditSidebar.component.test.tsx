import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card, { CardDetails } from '@utils/datatypes/Card';
import { DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';

import CubeListEditSidebar from 'components/cube/CubeListEditSidebar';
import AutocardContext from 'contexts/AutocardContext';
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
    details: { oracle_id: oracleId, name: `Card ${oracleId}`, set: 'old', collector_number: `${index}` },
  }) as Card;

const renderSidebar = ({
  isHorizontal = false,
  changedCards,
  unfilteredChangedCards = changedCards,
  bulkRemoveCard = jest.fn(),
  bulkEditPrinting = jest.fn(),
  showCard = jest.fn(),
}: {
  isHorizontal?: boolean;
  changedCards: Record<string, Card[]>;
  unfilteredChangedCards?: Record<string, Card[]>;
  bulkRemoveCard?: jest.Mock;
  bulkEditPrinting?: jest.Mock;
  showCard?: jest.Mock;
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
        <AutocardContext.Provider
          value={{ showCard, hideCard: jest.fn(), stopAutocard: false, setStopAutocard: jest.fn() }}
        >
          <CubeContext.Provider value={cubeValue as any}>
            <CubeListEditSidebar isHorizontal={isHorizontal} />
          </CubeContext.Provider>
        </AutocardContext.Provider>
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
  });

  /*
   * The displayed board and the Board select can disagree — a view spanning several boards
   * defaults the select to the first one — so the modal shows which boards it acts on, by label,
   * starting from the edited board alone.
   */
  it('starts with only the edited board checked', () => {
    renderSidebar({ changedCards, unfilteredChangedCards });

    fireEvent.click(screen.getByText('Cleanup'));

    expect(screen.getByRole('checkbox', { name: 'Mainboard' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Maybeboard' })).not.toBeChecked();
  });

  it('lists exactly the cards it would remove, and stages exactly those', () => {
    const bulkRemoveCard = jest.fn();
    renderSidebar({ changedCards, unfilteredChangedCards, bulkRemoveCard });

    fireEvent.click(screen.getByText('Cleanup'));

    // The second copy of "dup" goes; the first stays and is not listed.
    expect(screen.getByText('Card dup')).toBeInTheDocument();
    expect(screen.getByText('OLD-1')).toBeInTheDocument();
    expect(screen.queryByText('OLD-0')).not.toBeInTheDocument();
    // A single board needs no board column.
    expect(screen.queryByText('Mainboard', { selector: 'span:not(label span)' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Remove Duplicates (1)'));

    expect(bulkRemoveCard).toHaveBeenCalledTimes(1);
    expect(bulkRemoveCard.mock.calls[0][0]).toEqual([{ index: 1, board: 'mainboard' }]);
    expect(mockTrackEvent).toHaveBeenCalledWith('cube_cleanup_duplicates', { count: 1, board: 'mainboard' });
  });

  /*
   * Checking a second board finds duplicates across both, keeping the copy on the earlier board,
   * so "shared" leaves the maybeboard. Cleanup is filter-scoped on every checked board: it must
   * read changedCards, never unfilteredChangedCards, or this would stage 5 removals, not 2.
   */
  it("removes copies across every checked board, keeping the earliest board's, among visible cards only", () => {
    const bulkRemoveCard = jest.fn();
    renderSidebar({ changedCards, unfilteredChangedCards, bulkRemoveCard });

    fireEvent.click(screen.getByText('Cleanup'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Maybeboard' }));

    expect(screen.getByText('Card shared')).toBeInTheDocument();
    expect(screen.getByText('Maybeboard', { selector: 'span:not(label span)' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Remove Duplicates (2)'));

    expect(bulkRemoveCard.mock.calls[0][0]).toEqual([
      { index: 1, board: 'mainboard' },
      { index: 0, board: 'maybeboard' },
    ]);
    expect(mockTrackEvent).toHaveBeenCalledWith('cube_cleanup_duplicates', {
      count: 2,
      board: 'mainboard,maybeboard',
    });
  });

  it('starts over from the edited board when reopened', async () => {
    renderSidebar({ changedCards, unfilteredChangedCards });

    fireEvent.click(screen.getByText('Cleanup'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Maybeboard' }));
    fireEvent.click(screen.getByText('Remove Duplicates (2)'));

    await waitFor(() => expect(screen.queryByText('Remove Duplicates (2)')).not.toBeInTheDocument());
    fireEvent.click(screen.getByText('Cleanup'));

    expect(screen.getByRole('checkbox', { name: 'Maybeboard' })).not.toBeChecked();
    expect(screen.getByText('Remove Duplicates (1)')).toBeInTheDocument();
  });

  it('previews a listed card on hover', () => {
    const showCard = jest.fn();
    renderSidebar({ changedCards, unfilteredChangedCards, showCard });

    fireEvent.click(screen.getByText('Cleanup'));
    fireEvent.mouseEnter(screen.getByText('Card dup'));

    expect(showCard.mock.calls[0][0]).toMatchObject({ index: 1, board: 'mainboard', cardID: 'card-mainboard-1' });
  });

  it('disables the removal with nothing to remove, and opening the modal alone stages nothing', () => {
    const bulkRemoveCard = jest.fn();
    renderSidebar({
      changedCards: { mainboard: [makeCard(0, 'mainboard', 'solo')], maybeboard: [] },
      bulkRemoveCard,
    });

    fireEvent.click(screen.getByText('Cleanup'));

    expect(screen.getByText('Remove Duplicates (0)')).toBeDisabled();
    expect(screen.queryByText('Card solo')).not.toBeInTheDocument();
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

    it('lists and stages exactly the moves the count advertises', async () => {
      mockGetPrintings.mockResolvedValue({ 'card-mainboard-2': newPrinting });
      const bulkEditPrinting = jest.fn();
      renderSidebar({ changedCards, unfilteredChangedCards, bulkEditPrinting });

      openPrintingsTab();
      const button = await screen.findByText('Update Printings (1)');

      expect(screen.getByText('OLD-2')).toBeInTheDocument();
      expect(screen.getByText('NEW-9')).toBeInTheDocument();

      fireEvent.click(button);

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

    it('previews both printings of a move on hover', async () => {
      mockGetPrintings.mockResolvedValue({ 'card-mainboard-2': newPrinting });
      const showCard = jest.fn();
      renderSidebar({ changedCards, unfilteredChangedCards, showCard });

      openPrintingsTab();
      await screen.findByText('Update Printings (1)');

      fireEvent.mouseEnter(screen.getByText('OLD-2'));
      expect(showCard.mock.calls[0][0]).toMatchObject({
        cardID: 'card-mainboard-2',
        details: { set: 'old', collector_number: '2' },
      });

      fireEvent.mouseEnter(screen.getByText('NEW-9'));
      expect(showCard.mock.calls[1][0]).toMatchObject({ cardID: 'new-printing', details: newPrinting });
    });
  });
});
