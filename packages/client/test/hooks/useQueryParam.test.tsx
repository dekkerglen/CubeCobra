import React from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import useQueryParam from 'hooks/useQueryParam';

const renderedValues: string[] = [];

const Harness: React.FC<{ defaultValue?: string }> = ({ defaultValue = 'a' }) => {
  const [value, setValue] = useQueryParam('tab', defaultValue);
  renderedValues.push(value);
  return (
    <div>
      <span data-testid="value">{value}</span>
      <button onClick={() => setValue('b')}>set-b</button>
      <button onClick={() => setValue(defaultValue)}>set-default</button>
    </div>
  );
};

describe('useQueryParam', () => {
  beforeEach(() => {
    renderedValues.length = 0;
    window.history.replaceState({}, '', '/page');
  });

  it('uses the URL value on the very first render', () => {
    window.history.replaceState({}, '', '/page?tab=c');
    render(<Harness />);
    expect(renderedValues[0]).toBe('c');
    expect(renderedValues.every((v) => v === 'c')).toBe(true);
  });

  it('uses the default when the URL has no param, without pushing history', () => {
    const pushState = jest.spyOn(window.history, 'pushState');
    render(<Harness />);
    expect(screen.getByTestId('value')).toHaveTextContent('a');
    expect(pushState).not.toHaveBeenCalled();
    pushState.mockRestore();
  });

  it('does not push history when seeded from the URL on mount', () => {
    window.history.replaceState({}, '', '/page?tab=c');
    const pushState = jest.spyOn(window.history, 'pushState');
    render(<Harness />);
    expect(pushState).not.toHaveBeenCalled();
    pushState.mockRestore();
  });

  it('pushes a history entry when the value changes', () => {
    const before = window.history.length;
    render(<Harness />);
    fireEvent.click(screen.getByText('set-b'));
    expect(window.location.search).toBe('?tab=b');
    expect(window.history.length).toBe(before + 1);
  });

  it('removes the param when set back to the default value', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('set-b'));
    fireEvent.click(screen.getByText('set-default'));
    expect(new URLSearchParams(window.location.search).has('tab')).toBe(false);
    expect(screen.getByTestId('value')).toHaveTextContent('a');
  });

  it('re-syncs from the URL on popstate', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('set-b'));
    expect(screen.getByTestId('value')).toHaveTextContent('b');

    window.history.replaceState({}, '', '/page?tab=z');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByTestId('value')).toHaveTextContent('z');

    window.history.replaceState({}, '', '/page');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByTestId('value')).toHaveTextContent('a');
  });
});
