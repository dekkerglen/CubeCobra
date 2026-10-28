import React from 'react';

import { DndContext } from '@dnd-kit/core';
import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import RemovedPile from 'components/RemovedPile';

import { createCard, createCardDetails } from '../../../server/test/test-utils/data';

const bolt = createCard({ cardID: 'bolt', details: createCardDetails({ name: 'Lightning Bolt' }) });
const elves = createCard({ cardID: 'elves', details: createCardDetails({ name: 'Llanowar Elves' }) });

const renderPile = (cards = [bolt, elves]) => render(<DndContext>{<RemovedPile cards={cards} />}</DndContext>);

describe('RemovedPile', () => {
  beforeAll(() => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as any;
  });

  it('renders nothing when no cards have been removed', () => {
    renderPile([]);

    expect(screen.queryByText(/Removed/)).not.toBeInTheDocument();
  });

  it('shows a collapsed count of removed cards', () => {
    renderPile();

    expect(screen.getByText('Removed (2)')).toBeInTheDocument();
    expect(screen.queryByAltText('Lightning Bolt')).not.toBeInTheDocument();
  });

  it('reveals the removed cards when the count is clicked', () => {
    renderPile();

    fireEvent.click(screen.getByText('Removed (2)'));

    expect(screen.getByAltText('Lightning Bolt')).toBeInTheDocument();
    expect(screen.getByAltText('Llanowar Elves')).toBeInTheDocument();
  });

  it('exposes the toggle as a keyboard-reachable button with its expanded state', () => {
    renderPile();

    const toggle = screen.getByRole('button', { name: 'Removed (2)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses again once emptied', () => {
    const { rerender } = renderPile();
    fireEvent.click(screen.getByText('Removed (2)'));

    rerender(<DndContext>{<RemovedPile cards={[]} />}</DndContext>);
    rerender(<DndContext>{<RemovedPile cards={[bolt]} />}</DndContext>);

    expect(screen.getByText('Removed (1)')).toBeInTheDocument();
    expect(screen.queryByAltText('Lightning Bolt')).not.toBeInTheDocument();
  });
});
