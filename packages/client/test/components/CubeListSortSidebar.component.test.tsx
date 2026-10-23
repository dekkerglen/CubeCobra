import React from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

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
}: {
  canEdit: boolean;
  isHorizontal: boolean;
  csrfFetch: jest.Mock;
}) => {
  const cubeValue = {
    cube: { id: 'c1', defaultSorts: [] },
    canEdit,
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
      <DisplayContextProvider cubeID="c1" savedDisplayOptions={DEFAULT_CUBE_DISPLAY_OPTIONS}>
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

describe('CubeListSortSidebar horizontal layout', () => {
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
