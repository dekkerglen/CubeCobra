import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import useChangelogView from 'hooks/useChangelogView';

const Harness: React.FC = () => {
  const [view, setView] = useChangelogView();
  return (
    <div>
      <span data-testid="view">{view}</span>
      <button onClick={() => setView('text')}>text</button>
    </div>
  );
};

describe('useChangelogView', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to cards and persists the choice', () => {
    render(<Harness />);
    expect(screen.getByTestId('view')).toHaveTextContent('cards');

    fireEvent.click(screen.getByRole('button', { name: 'text' }));

    expect(screen.getByTestId('view')).toHaveTextContent('text');
    expect(window.localStorage.getItem('changelogView')).toBe('"text"');
  });

  it('falls back to cards when storage holds an unknown value', () => {
    window.localStorage.setItem('changelogView', '"bogus"');
    render(<Harness />);

    expect(screen.getByTestId('view')).toHaveTextContent('cards');
  });
});
