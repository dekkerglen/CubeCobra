import React from 'react';

import { act, fireEvent, render, screen, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import { DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';

import CubeListSortSidebar from 'components/cube/CubeListSortSidebar';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';

jest.mock('components/modals/TagColorsModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('components/modals/RotisserieDraftModal', () => ({
  __esModule: true,
  default: () => null,
}));

const SAVE = 'Save as Default Options';
const RESET = 'Reset Options';
const SAVE_ERROR = "Couldn't save the default display options. Please make sure you're logged in and try again.";

const renderSidebar = ({
  canEdit,
  isHorizontal,
  csrfFetch,
  sortPrimary = 'Color Category',
  sortSecondary = 'Unsorted',
  cards = {},
  cardsLoading = false,
  displayView,
}: {
  canEdit: boolean;
  isHorizontal: boolean;
  csrfFetch: jest.Mock;
  sortPrimary?: string;
  sortSecondary?: string;
  cards?: Record<string, any[]>;
  cardsLoading?: boolean;
  displayView?: string;
}) => {
  const cubeValue = {
    cube: { id: 'c1', defaultSorts: [] },
    canEdit,
    changedCards: cards,
    cardsLoading,
    sortPrimary,
    sortSecondary,
    sortTertiary: 'Unsorted',
    sortQuaternary: 'Alphabetical',
    resetSorts: jest.fn(),
    saveSorts: jest.fn(),
    effectiveDefaultSorts: [],
    setSortPrimary: jest.fn(),
    setSortSecondary: jest.fn(),
    setSortTertiary: jest.fn(),
    setSortQuaternary: jest.fn(),
  };
  return render(
    <CSRFContext.Provider value={{ csrfToken: 't', csrfFetch, callApi: jest.fn() } as any}>
      <DisplayContextProvider
        cubeID="c1"
        savedDisplayOptions={DEFAULT_CUBE_DISPLAY_OPTIONS}
        displayViewDefaults={displayView ? { mainboard: displayView } : undefined}
      >
        <CubeContext.Provider value={cubeValue as any}>
          <CubeListSortSidebar canEdit={canEdit} isHorizontal={isHorizontal} />
        </CubeContext.Provider>
      </DisplayContextProvider>
    </CSRFContext.Provider>,
  );
};

const checkbox = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const button = (name: string) => screen.getByRole('button', { name });
const gridColumn = (el: HTMLElement) => el.closest('.grid > *');

const card = (index: number, tags: string[], board = 'mainboard') => ({
  cardID: `card-${index}`,
  index,
  board,
  tags,
  details: { name: `Card ${index}`, type: 'Instant', colors: [], color_identity: [] },
});

describe.each([
  ['vertical', false],
  ['horizontal', true],
])('CubeListSortSidebar hidden-cards notice (%s)', (_layout, isHorizontal) => {
  const untaggedCube = { mainboard: [card(0, ['Removal']), card(1, []), card(2, [])] };

  it('says how many cards the current sorts hide', () => {
    renderSidebar({ canEdit: false, isHorizontal, csrfFetch: jest.fn(), sortPrimary: 'Tags', cards: untaggedCube });
    expect(screen.getByText(/2 cards are hidden/)).toBeInTheDocument();
    expect(screen.getByText(/by the current sorts/)).toBeInTheDocument();
    const buttons = within(screen.getByRole('status')).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Show Unsorted Cards']);
  });

  it('uses the singular for one hidden card', () => {
    renderSidebar({
      canEdit: false,
      isHorizontal,
      csrfFetch: jest.fn(),
      sortPrimary: 'Tags',
      cards: { mainboard: [card(0, ['Removal']), card(1, [])] },
    });
    expect(screen.getByText(/1 card is hidden/)).toBeInTheDocument();
  });

  it('shows nothing when no cards are hidden', () => {
    renderSidebar({ canEdit: false, isHorizontal, csrfFetch: jest.fn(), cards: untaggedCube });
    expect(screen.queryByText(/hidden/)).not.toBeInTheDocument();
  });

  it('waits for card details before counting', () => {
    const loading = { mainboard: [{ cardID: 'x', index: 0, board: 'mainboard', tags: [] }] };
    renderSidebar({
      canEdit: false,
      isHorizontal,
      csrfFetch: jest.fn(),
      sortPrimary: 'Types-Multicolor',
      cards: loading,
      cardsLoading: true,
    });
    expect(screen.queryByText(/hidden/)).not.toBeInTheDocument();
  });

  it('ignores boards that are not on screen', () => {
    renderSidebar({
      canEdit: false,
      isHorizontal,
      csrfFetch: jest.fn(),
      sortPrimary: 'Tags',
      cards: { mainboard: [card(0, ['Removal'])], maybeboard: [card(1, [], 'maybeboard')] },
    });
    expect(screen.queryByText(/hidden/)).not.toBeInTheDocument();
  });

  it('Show Unsorted Cards turns the option on for this page and clears the notice', () => {
    const csrfFetch = jest.fn();
    renderSidebar({ canEdit: true, isHorizontal, csrfFetch, sortPrimary: 'Tags', cards: untaggedCube });

    fireEvent.click(button('Show Unsorted Cards'));

    expect(checkbox('Show Unsorted Cards')).toBeChecked();
    expect(screen.queryByText(/cards are hidden/)).not.toBeInTheDocument();
    expect(csrfFetch).not.toHaveBeenCalled();
  });

  it('sits with the sort dropdowns, above the duplicates note', () => {
    renderSidebar({ canEdit: false, isHorizontal, csrfFetch: jest.fn(), sortPrimary: 'Tags', cards: untaggedCube });
    const notice = screen.getByText(/2 cards are hidden/);
    const ordered = screen.getByText('Ordered Sort');
    const note = screen.getByText(/Cards will appear as duplicates/);
    expect(ordered.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe.each([
  ['vertical', false],
  ['horizontal', true],
])('CubeListSortSidebar display options (%s)', (_layout, isHorizontal) => {
  let csrfFetch: jest.Mock;

  beforeEach(() => {
    csrfFetch = jest.fn();
  });

  it('lists Show Tag Colors directly below Show Inline Emojis', () => {
    renderSidebar({ canEdit: false, isHorizontal, csrfFetch });
    const labels = screen.getAllByRole('checkbox').map((el) => el.closest('label')?.textContent);
    expect(labels.indexOf('Show Tag Colors')).toBe(labels.indexOf('Show Inline Emojis') + 1);
  });

  it('groups Set Tag Colors with the options buttons', () => {
    renderSidebar({ canEdit: true, isHorizontal, csrfFetch });
    expect(button('Set Tag Colors').parentElement).toBe(button(SAVE).parentElement);
    expect(button(RESET).parentElement).toBe(button(SAVE).parentElement);
  });

  it('disables Save while a save is in flight', async () => {
    let resolveSave: (value: { ok: boolean }) => void = () => {};
    csrfFetch.mockReturnValue(new Promise((resolve) => (resolveSave = resolve)));
    renderSidebar({ canEdit: true, isHorizontal, csrfFetch });

    fireEvent.click(checkbox('Show Unsorted Cards'));
    fireEvent.click(button(SAVE));
    fireEvent.click(button(SAVE));

    expect(csrfFetch).toHaveBeenCalledTimes(1);
    expect(button(SAVE)).toBeDisabled();

    await act(async () => resolveSave({ ok: true }));
    expect(csrfFetch).toHaveBeenCalledTimes(1);
  });

  it('shows seven display checkboxes including Show Tag Colors', () => {
    renderSidebar({ canEdit: false, isHorizontal, csrfFetch });
    for (const label of [
      'Show Unsorted Cards',
      'Collapse Duplicates',
      'Show Inline Emojis',
      'Show Tag Colors',
      'Show Tag Quick Filters',
      'Show All Boards',
      'Use Base Card Data',
    ]) {
      expect(checkbox(label)).toBeInTheDocument();
    }
    expect(checkbox('Show Tag Colors')).toBeChecked();
    expect(checkbox('Show Tag Quick Filters')).toBeChecked();
  });

  it('non-editors get no Save as Default Options and no Set Tag Colors', () => {
    renderSidebar({ canEdit: false, isHorizontal, csrfFetch });

    expect(screen.queryByRole('button', { name: SAVE })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set Tag Colors' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Tag Colors' })).not.toBeInTheDocument();

    fireEvent.click(checkbox('Show Tag Colors'));
    expect(checkbox('Show Tag Colors')).not.toBeChecked();
    expect(csrfFetch).not.toHaveBeenCalled();
  });

  it('editors: Save and Reset are disabled until something changes', () => {
    renderSidebar({ canEdit: true, isHorizontal, csrfFetch });

    expect(button(SAVE)).toBeDisabled();
    expect(button(RESET)).toBeDisabled();

    fireEvent.click(checkbox('Show Tag Colors'));

    expect(button(SAVE)).toBeEnabled();
    expect(button(RESET)).toBeEnabled();
    expect(csrfFetch).not.toHaveBeenCalled();
  });

  it('Save as Default Options posts once and disables again on success', async () => {
    csrfFetch.mockResolvedValue({ ok: true });
    renderSidebar({ canEdit: true, isHorizontal, csrfFetch });

    fireEvent.click(checkbox('Show Unsorted Cards'));
    await act(async () => {
      fireEvent.click(button(SAVE));
    });

    expect(csrfFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(csrfFetch.mock.calls[0][1].body).displayOptions.showUnsorted).toBe(true);
    expect(button(SAVE)).toBeDisabled();
  });

  it('failed save shows the error alert and keeps the button enabled', async () => {
    csrfFetch.mockResolvedValue({ ok: false });
    renderSidebar({ canEdit: true, isHorizontal, csrfFetch });

    fireEvent.click(checkbox('Show Unsorted Cards'));
    await act(async () => {
      fireEvent.click(button(SAVE));
    });

    expect(screen.getByText(SAVE_ERROR)).toBeInTheDocument();
    expect(button(SAVE)).toBeEnabled();
    expect(checkbox('Show Unsorted Cards')).toBeChecked();
  });

  it('Reset Options restores the saved values', () => {
    renderSidebar({ canEdit: false, isHorizontal, csrfFetch });

    fireEvent.click(checkbox('Show All Boards'));
    expect(checkbox('Show All Boards')).toBeChecked();

    fireEvent.click(button(RESET));

    expect(checkbox('Show All Boards')).not.toBeChecked();
    expect(button(RESET)).toBeDisabled();
  });
});

describe.each([
  ['vertical', false],
  ['horizontal', true],
])('CubeListSortSidebar in Curve view (%s)', (_layout, isHorizontal) => {
  const CURVE_NOTE = 'Curve view only uses the Primary sort.';
  const sortSelects = () => screen.getAllByRole('combobox');

  beforeEach(() => {
    window.history.replaceState({}, '', '/cube/list/c1');
  });

  it('disables every sort but Primary and says why', () => {
    renderSidebar({ canEdit: false, isHorizontal, csrfFetch: jest.fn(), displayView: 'curve' });
    const [primary, secondary, tertiary, ordered] = sortSelects();
    expect(primary).toBeEnabled();
    expect(secondary).toBeDisabled();
    expect(tertiary).toBeDisabled();
    expect(ordered).toBeDisabled();
    expect(screen.getByText(CURVE_NOTE)).toBeInTheDocument();
  });

  it('leaves every sort enabled in other views', () => {
    renderSidebar({ canEdit: false, isHorizontal, csrfFetch: jest.fn(), displayView: 'table' });
    for (const select of sortSelects()) {
      expect(select).toBeEnabled();
    }
    expect(screen.queryByText(CURVE_NOTE)).not.toBeInTheDocument();
  });

  it('counts only cards the Primary sort hides', () => {
    const cards = { mainboard: [card(0, ['Removal']), card(1, []), card(2, [])] };
    renderSidebar({
      canEdit: false,
      isHorizontal,
      csrfFetch: jest.fn(),
      sortSecondary: 'Tags',
      cards,
      displayView: 'curve',
    });
    expect(screen.queryByText(/hidden/)).not.toBeInTheDocument();
  });

  it('still counts cards the Primary sort hides', () => {
    const cards = { mainboard: [card(0, ['Removal']), card(1, []), card(2, [])] };
    renderSidebar({
      canEdit: false,
      isHorizontal,
      csrfFetch: jest.fn(),
      sortPrimary: 'Tags',
      cards,
      displayView: 'curve',
    });
    expect(screen.getByText(/2 cards are hidden/)).toBeInTheDocument();
  });
});

describe('CubeListSortSidebar horizontal layout', () => {
  it('explains duplicates on its own row below both sort columns', () => {
    renderSidebar({ canEdit: false, isHorizontal: true, csrfFetch: jest.fn() });
    const note = screen.getByText(/Cards will appear as duplicates/);
    const primary = screen.getByText('Primary Sort');
    const ordered = screen.getByText('Ordered Sort');

    expect(gridColumn(ordered)).not.toContainElement(note);
    expect(gridColumn(primary)).not.toContainElement(note);
    expect(gridColumn(note)).toContainElement(primary);
    expect(gridColumn(note)).toContainElement(ordered);
    expect(note.compareDocumentPosition(ordered) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });
  it.each([false, true])('has no Rotisserie buttons (horizontal: %s)', (isHorizontal) => {
    renderSidebar({ canEdit: true, isHorizontal, csrfFetch: jest.fn() });
    expect(screen.queryByRole('button', { name: /Rotisserie/ })).not.toBeInTheDocument();
  });
  it('puts the options buttons in the Actions column, after the sort buttons and a divider', () => {
    renderSidebar({ canEdit: true, isHorizontal: true, csrfFetch: jest.fn() });

    const actions = gridColumn(button('Reset Sort'))!;
    expect(gridColumn(button(SAVE))).toBe(actions);
    expect(gridColumn(button(RESET))).toBe(actions);
    expect(gridColumn(button('Set Tag Colors'))).toBe(actions);
    expect(gridColumn(checkbox('Show Tag Colors'))).not.toBe(actions);

    const divider = actions.querySelector('hr');
    expect(divider).not.toBeNull();
    const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(button('Reset Sort'), divider!)).toBe(true);
    expect(follows(divider!, button(SAVE))).toBe(true);
  });
});
