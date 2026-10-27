import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import DeckBuilderStatsPanel from 'components/DeckBuilderStatsPanel';
import DisplayContext from 'contexts/DisplayContext';

import { defaultDisplayContext } from '../../../server/test/test-utils/context';

jest.mock('react-chartjs-2', () => ({ Bar: () => <div data-testid="bar" /> }));

const renderPanel = () =>
  render(
    <DisplayContext.Provider value={{ ...defaultDisplayContext, showDeckBuilderStatsPanel: true }}>
      <DeckBuilderStatsPanel cards={[]} />
    </DisplayContext.Provider>,
  );

describe('DeckBuilderStatsPanel', () => {
  it('renders an empty deck without NaN', () => {
    const { container } = renderPanel();

    expect(screen.getByText('Mana Breakdown')).toBeInTheDocument();
    expect(container.textContent).not.toContain('NaN');
  });

  it('uses theme colors rather than light-only ones', () => {
    const { container } = renderPanel();

    expect(container.querySelector('.bg-white, .bg-gray-100, .text-gray-500, .border-gray-300')).toBeNull();
  });
});
