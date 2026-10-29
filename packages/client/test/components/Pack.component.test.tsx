import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Pack from '../../src/components/Pack';

jest.mock('components/DraggableCard', () => () => <div>Draggable Card</div>);
jest.mock('components/FoilCardImage', () => () => <div>Foil Card</div>);

const createPack = () => [{ details: { scryfall_id: 'a' } }, { details: { scryfall_id: 'b' } }] as any;

const renderPack = (props: Record<string, unknown> = {}) =>
  render(<Pack pack={createPack()} packSize={2} {...props} />);

describe('Pack bot ratings toggle', () => {
  it('labels the button Show when ratings are hidden', () => {
    renderPack({ ratings: [0.75, 0.25], showRatings: false });

    expect(screen.getByRole('button', { name: 'Show CubeCobra Bot Ratings' })).toBeInTheDocument();
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
  });

  it('labels the button Hide and renders percentages when ratings are shown', () => {
    renderPack({ ratings: [0.75, 0.25], showRatings: true });

    expect(screen.getByRole('button', { name: 'Hide CubeCobra Bot Ratings' })).not.toHaveClass('invisible');
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('calls onToggleRatings when the button is clicked', () => {
    const onToggleRatings = jest.fn();
    renderPack({ ratings: [0.75, 0.25], showRatings: false, onToggleRatings });

    fireEvent.click(screen.getByRole('button', { name: 'Show CubeCobra Bot Ratings' }));

    expect(onToggleRatings).toHaveBeenCalledTimes(1);
  });

  it('keeps ratings visible when the pack prop identity changes', () => {
    const { rerender } = render(<Pack pack={createPack()} packSize={2} ratings={[0.75, 0.25]} showRatings />);
    expect(screen.getByText('75%')).toBeInTheDocument();

    rerender(<Pack pack={createPack()} packSize={2} ratings={[0.75, 0.25]} showRatings />);

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('hides the button when no ratings are available', () => {
    renderPack({ ratings: [], showRatings: false });

    expect(screen.getByRole('button', { name: 'Show CubeCobra Bot Ratings' })).toHaveClass('invisible');
  });

  it('preserves the caller toggle state while showing the retry button on error', () => {
    renderPack({ ratings: [0.75, 0.25], showRatings: true, error: true, onRetry: jest.fn() });

    expect(screen.getByRole('button', { name: 'Bot picks failed. Try again?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /CubeCobra Bot Ratings/ })).not.toBeInTheDocument();
  });

  it('renders and tolerates a click without the toggle props', () => {
    renderPack({ ratings: [0.75, 0.25] });

    const button = screen.getByRole('button', { name: 'Show CubeCobra Bot Ratings' });
    expect(() => fireEvent.click(button)).not.toThrow();
  });
});
