import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import CubeViewSwitcher, { CardsPerRowSelect } from 'components/cube/CubeViewSwitcher';
import UserContext, { UserContextValue } from 'contexts/UserContext';

const renderSwitcher = (props: Partial<React.ComponentProps<typeof CubeViewSwitcher>> = {}, user: unknown = null) =>
  render(
    <UserContext.Provider value={user as UserContextValue | null}>
      <CubeViewSwitcher view="table" setView={jest.fn()} {...props} />
    </UserContext.Provider>,
  );

describe('CubeViewSwitcher', () => {
  it('renders the four view buttons and no List button by default', () => {
    renderSwitcher();

    for (const name of ['Table View', 'Visual Spoiler', 'Curve View', 'Card Stacks']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'List View' })).toBeNull();
  });

  it('renders the List button when includeList', () => {
    renderSwitcher({ includeList: true });

    expect(screen.getByRole('button', { name: 'List View' })).toBeInTheDocument();
  });

  it('marks the active view pressed and calls setView on click', () => {
    const setView = jest.fn();
    renderSwitcher({ view: 'table', setView });

    expect(screen.getByRole('button', { name: 'Table View' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Visual Spoiler' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Visual Spoiler' }));

    expect(setView).toHaveBeenCalledWith('spoiler');
  });

  it('renders a select instead of icons when the user prefers text', () => {
    renderSwitcher({}, { useTextOverIcons: true });

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Table View' })).toBeNull();
  });
});

describe('CardsPerRowSelect', () => {
  it('CardsPerRowSelect calls setValue with a number', () => {
    const setValue = jest.fn();
    render(<CardsPerRowSelect value={3} setValue={setValue} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '4' } });

    expect(setValue).toHaveBeenCalledWith(4);
  });
});
