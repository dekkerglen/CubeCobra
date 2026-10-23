import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import useLocalStorage from 'hooks/useLocalStorage';

const Harness: React.FC<{ storageKey: string }> = ({ storageKey }) => {
  const [value, setValue] = useLocalStorage<boolean>(storageKey, false);
  return (
    <div>
      <span data-testid="value">{String(value)}</span>
      <button onClick={() => setValue(!value)}>toggle</button>
    </div>
  );
};

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads the stored value for the initial key', () => {
    window.localStorage.setItem('a', 'true');
    render(<Harness storageKey="a" />);
    expect(screen.getByTestId('value')).toHaveTextContent('true');
  });

  it('re-reads the stored value when the key changes', () => {
    window.localStorage.setItem('a', 'true');
    const { rerender } = render(<Harness storageKey="a" />);
    expect(screen.getByTestId('value')).toHaveTextContent('true');

    rerender(<Harness storageKey="b" />);
    expect(screen.getByTestId('value')).toHaveTextContent('false');
  });

  it('toggles from the current key value after the key changes', () => {
    window.localStorage.setItem('a', 'true');
    const { rerender } = render(<Harness storageKey="a" />);

    rerender(<Harness storageKey="b" />);
    fireEvent.click(screen.getByText('toggle'));

    expect(screen.getByTestId('value')).toHaveTextContent('true');
    expect(window.localStorage.getItem('b')).toBe('true');
    expect(window.localStorage.getItem('a')).toBe('true');
  });
});
