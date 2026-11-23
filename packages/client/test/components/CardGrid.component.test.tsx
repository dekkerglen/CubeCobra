import React from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card from '@utils/datatypes/Card';

import CardGrid from 'components/card/CardGrid';

jest.mock('components/FoilCardImage', () => ({
  __esModule: true,
  default: ({ card }: { card: Card }) => <img alt={card.cardID} />,
}));

const cards = [{ cardID: 'card-a' }, { cardID: 'card-b' }] as Card[];

const wrapperOf = (cardID: string) => screen.getByAltText(cardID).parentElement as HTMLElement;

// jsdom has no PointerEvent, so fireEvent would drop `pointerType`.
if (!('PointerEvent' in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerType: string;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? '';
    }
  }
  (window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill;
}

describe('CardGrid', () => {
  it('renders a badge with its title for the indexed card', () => {
    render(
      <CardGrid cards={cards} badges={[undefined, { label: '+', title: 'Added', className: 'bg-green-600/90' }]} />,
    );

    const badge = within(wrapperOf('card-b')).getByLabelText('Added');
    expect(badge).toHaveAttribute('title', 'Added');
    expect(badge).toHaveClass('bg-green-600/90', 'top-[14%]', 'right-[8%]');
    expect(badge).toHaveTextContent('+');
    expect(screen.getAllByLabelText('Added')).toHaveLength(1);
    expect(within(wrapperOf('card-a')).queryByLabelText('Added')).not.toBeInTheDocument();
  });

  it('rings the given indices', () => {
    render(<CardGrid cards={cards} ringedIndices={[1]} />);

    expect(wrapperOf('card-b')).toHaveClass('ring-[#007BFF]');
    expect(wrapperOf('card-a')).not.toHaveClass('ring-[#007BFF]');
  });

  it('reports mouse hover enter and leave', () => {
    const onCardHover = jest.fn();
    render(<CardGrid cards={cards} onCardHover={onCardHover} />);

    fireEvent.pointerEnter(wrapperOf('card-b'), { pointerType: 'mouse' });
    expect(onCardHover).toHaveBeenLastCalledWith(1);
    fireEvent.pointerLeave(wrapperOf('card-b'), { pointerType: 'mouse' });
    expect(onCardHover).toHaveBeenLastCalledWith(null);
    expect(onCardHover).toHaveBeenCalledTimes(2);
  });

  it('ignores touch, including the mouse events a tap emulates', () => {
    const onCardHover = jest.fn();
    render(<CardGrid cards={cards} onCardHover={onCardHover} />);

    fireEvent.pointerEnter(wrapperOf('card-b'), { pointerType: 'touch' });
    fireEvent.mouseEnter(wrapperOf('card-b'));
    fireEvent.pointerLeave(wrapperOf('card-b'), { pointerType: 'touch' });
    expect(onCardHover).not.toHaveBeenCalled();
  });

  it('renders unchanged without the new props', () => {
    const { container } = render(<CardGrid cards={cards} />);

    expect(container.querySelector('[aria-label]')).toBeNull();
    expect(container.querySelector('.ring-\\[\\#007BFF\\]')).toBeNull();
  });

  it('keeps the existing ratings rings when ringedIndices is absent', () => {
    render(<CardGrid cards={cards} ratings={[0.2, 0.8]} selectedIndex={0} />);

    expect(wrapperOf('card-b')).toHaveClass('ring-[#007BFF]');
    expect(wrapperOf('card-a')).toHaveClass('ring-[#E6B800]');
    expect(wrapperOf('card-a')).not.toHaveClass('ring-[#007BFF]');
  });
});
