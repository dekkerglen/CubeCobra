import React, { useContext } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import DisplayContext, { DisplayContextProvider } from 'contexts/DisplayContext';

const VIEW_SLUGS = ['mainboard', 'base-packs', 'r-d'];

const Consumer: React.FC = () => {
  const { activeView, setActiveView } = useContext(DisplayContext);
  return (
    <div>
      <span data-testid="active-view">{activeView}</span>
      <button onClick={() => setActiveView('r-d')}>select-r-d</button>
    </div>
  );
};

const renderProvider = () =>
  render(
    <DisplayContextProvider cubeID="cube-1" viewSlugs={VIEW_SLUGS}>
      <Consumer />
    </DisplayContextProvider>,
  );

const viewParam = () => new URLSearchParams(window.location.search).get('view');

describe('DisplayContext view navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/cube/list/cube-1');
  });

  it('uses the first view when the URL carries no view param', () => {
    renderProvider();
    expect(screen.getByTestId('active-view')).toHaveTextContent('mainboard');
  });

  it('activates the view named by the slug in the URL', () => {
    window.history.replaceState({}, '', '/cube/list/cube-1?view=base-packs');
    renderProvider();
    expect(screen.getByTestId('active-view')).toHaveTextContent('base-packs');
  });

  it('resolves legacy links that carried the display name', () => {
    window.history.replaceState({}, '', `/cube/list/cube-1?view=${encodeURIComponent('Base Packs')}`);
    renderProvider();
    expect(screen.getByTestId('active-view')).toHaveTextContent('base-packs');
  });

  it('falls back to the first view when the param matches nothing', () => {
    window.history.replaceState({}, '', '/cube/list/cube-1?view=no-such-view');
    renderProvider();
    expect(screen.getByTestId('active-view')).toHaveTextContent('mainboard');
  });

  it('clears an unmatched param without trapping the back button', () => {
    window.history.replaceState({}, '', '/cube/list/cube-1?view=r%2526d');
    const pushState = jest.spyOn(window.history, 'pushState');

    renderProvider();

    expect(viewParam()).toBeNull();
    expect(pushState).not.toHaveBeenCalled();
    pushState.mockRestore();
  });

  it('leaves other query params alone when clearing an unmatched view', () => {
    window.history.replaceState({}, '', '/cube/list/cube-1?view=no-such-view&f=t%3Aramp');
    renderProvider();
    expect(viewParam()).toBeNull();
    expect(new URLSearchParams(window.location.search).get('f')).toBe('t:ramp');
  });

  it('writes the plain slug to the URL when a view is selected', () => {
    renderProvider();

    fireEvent.click(screen.getByText('select-r-d'));

    expect(screen.getByTestId('active-view')).toHaveTextContent('r-d');
    expect(viewParam()).toBe('r-d');
    expect(window.location.search).toBe('?view=r-d');
  });
});

describe('DisplayContext display view', () => {
  const DisplayViewConsumer: React.FC = () => {
    const { displayView, setDisplayView, setActiveView } = useContext(DisplayContext);
    return (
      <div>
        <span data-testid="display-view">{displayView}</span>
        <button onClick={() => setDisplayView('curve')}>show-curve</button>
        <button onClick={() => setActiveView('r-d')}>select-r-d</button>
      </div>
    );
  };

  const renderWithDefaults = (displayViewDefaults?: Record<string, string>) =>
    render(
      <DisplayContextProvider cubeID="cube-1" viewSlugs={VIEW_SLUGS} displayViewDefaults={displayViewDefaults}>
        <DisplayViewConsumer />
      </DisplayContextProvider>,
    );

  const displayParam = () => new URLSearchParams(window.location.search).get('display');

  beforeEach(() => {
    window.history.replaceState({}, '', '/cube/list/cube-1');
  });

  it('falls back to table when no defaults are given', () => {
    renderWithDefaults();
    expect(screen.getByTestId('display-view')).toHaveTextContent('table');
  });

  it("uses the active view's default display", () => {
    renderWithDefaults({ mainboard: 'spoiler' });
    expect(screen.getByTestId('display-view')).toHaveTextContent('spoiler');
  });

  it('reads the display from the URL', () => {
    window.history.replaceState({}, '', '/cube/list/cube-1?display=stacks');
    renderWithDefaults({ mainboard: 'spoiler' });
    expect(screen.getByTestId('display-view')).toHaveTextContent('stacks');
  });

  it('writes a changed display to the URL', () => {
    renderWithDefaults();
    fireEvent.click(screen.getByText('show-curve'));
    expect(screen.getByTestId('display-view')).toHaveTextContent('curve');
    expect(displayParam()).toBe('curve');
  });
});
