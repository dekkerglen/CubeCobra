import React from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { defaultFilter } from '@utils/filtering/FilterCards';

import AnalysisNavbar from 'components/cube/AnalysisNavbar';
import FilterContext, { FilterContextValue } from 'contexts/FilterContext';

jest.mock('components/modals/AdvancedFilterModal', () => () => <div />);
jest.mock('components/cube/AnalysisBoardPicker', () => () => <div />);

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
    <FilterContext.Provider value={value}>
      <AnalysisNavbar />
    </FilterContext.Provider>,
  );
};

const clearButton = () => screen.queryByRole('button', { name: 'Clear' });

describe('AnalysisNavbar filter', () => {
  it('shows no clear button when the filter is empty', () => {
    renderNavbar({ filterInput: '' });

    expect(clearButton()).not.toBeInTheDocument();
  });

  it('shows a clear button once the filter has text', () => {
    renderNavbar({ filterInput: 'set:otj' });

    expect(clearButton()).toBeInTheDocument();
  });

  it('clears both the local text and the applied filter', () => {
    const setFilterInput = jest.fn();
    renderNavbar({ filterInput: 'set:otj', setFilterInput });

    fireEvent.click(clearButton()!);

    expect(setFilterInput).toHaveBeenCalledWith('');
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('does not re-apply the old filter after the debounce window', () => {
    jest.useFakeTimers();
    const setFilterInput = jest.fn();

    try {
      renderNavbar({ filterInput: 'set:otj', setFilterInput });

      fireEvent.click(clearButton()!);
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(setFilterInput).not.toHaveBeenCalledWith('set:otj');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not resurrect the old filter when the input later blurs', () => {
    const setFilterInput = jest.fn();
    renderNavbar({ filterInput: 'set:otj', setFilterInput });

    fireEvent.click(clearButton()!);
    fireEvent.blur(screen.getByRole('textbox'));

    expect(setFilterInput).not.toHaveBeenCalledWith('set:otj');
  });

  it('lets the filter input grow rather than pinning it to a fixed width', () => {
    const { container } = renderNavbar({ filterInput: '' });

    const wrapper = container.querySelector('[data-testid="analysis-filter"]');

    expect(wrapper).toBeInTheDocument();
    expect(wrapper).not.toHaveStyle({ maxWidth: '400px' });
    expect(wrapper).toHaveClass('flex-grow');
  });
});
