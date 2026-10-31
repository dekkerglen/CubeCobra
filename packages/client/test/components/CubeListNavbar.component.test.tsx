import React from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { defaultFilter } from '@utils/filtering/FilterCards';

import CubeListNavbar from 'components/cube/CubeListNavbar';
import DisplayContext from 'contexts/DisplayContext';
import FilterContext, { FilterContextValue } from 'contexts/FilterContext';

import { defaultDisplayContext } from '../../../server/test/test-utils/context';

jest.mock('components/modals/AdvancedFilterModal', () => () => <div />);
jest.mock('components/cube/TagQuickFilters', () => () => <div />);

interface RenderOptions {
  filterInput?: string;
  setFilterInput?: jest.Mock;
}

const renderNavbar = ({ filterInput = '', setFilterInput = jest.fn() }: RenderOptions = {}) => {
  const value: FilterContextValue = {
    filterInput,
    setFilterInput,
    filterValid: true,
    cardFilter: { filter: defaultFilter() },
  };

  return render(
    <DisplayContext.Provider value={defaultDisplayContext}>
      <FilterContext.Provider value={value}>
        <CubeListNavbar cubeView="table" setCubeView={jest.fn()} />
      </FilterContext.Provider>
    </DisplayContext.Provider>,
  );
};

const clearButtons = () => screen.queryAllByRole('button', { name: 'Clear' });

describe('CubeListNavbar filter clear button', () => {
  // Both layout branches render into the DOM at once; `hidden lg:flex` / `lg:hidden`
  // only separate them visually, so a count of two is what proves both are wired.
  it('renders a clear button in both layout branches once there is text', () => {
    renderNavbar({ filterInput: 'set:otj' });

    expect(clearButtons()).toHaveLength(2);
  });

  it('renders no clear button when the filter is empty', () => {
    renderNavbar({ filterInput: '' });

    expect(clearButtons()).toHaveLength(0);
  });

  it('clears both the local text and the applied filter', () => {
    const setFilterInput = jest.fn();
    renderNavbar({ filterInput: 'set:otj', setFilterInput });

    fireEvent.click(clearButtons()[0]);

    expect(setFilterInput).toHaveBeenCalledWith('');
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('');
  });

  it('does not re-apply the old filter after the debounce window', () => {
    jest.useFakeTimers();
    const setFilterInput = jest.fn();

    try {
      renderNavbar({ filterInput: 'set:otj', setFilterInput });

      fireEvent.click(clearButtons()[0]);
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(setFilterInput).not.toHaveBeenCalledWith('set:otj');
    } finally {
      jest.useRealTimers();
    }
  });
});
