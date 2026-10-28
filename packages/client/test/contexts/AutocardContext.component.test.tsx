import React, { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card from '@utils/datatypes/Card';

import withAutocard from 'components/WithAutocard';
import { AutocardContextProvider } from 'contexts/AutocardContext';

const AutocardDiv = withAutocard('div');

const card = {
  cardID: 'bolt',
  details: { name: 'Lightning Bolt', image_normal: 'https://example.com/bolt.jpg' },
} as unknown as Card;

const otherCard = {
  cardID: 'ancestral',
  details: { name: 'Ancestral Recall', image_normal: 'https://example.com/ancestral.jpg' },
} as unknown as Card;

const VIEWPORT = { width: 1200, height: 800 };
const POPUP = { width: 240, height: 334 };
// Mutable so a test can model a double-faced preview, which is twice as wide.
let popupSize = { ...POPUP };

const popup = () => document.getElementById('autocardPopup') as HTMLDivElement;
const isShowing = () => popup().style.visibility === 'visible';
const popupLeft = () => parseFloat(popup().style.left);
const popupTop = () => parseFloat(popup().style.top);

beforeAll(() => {
  // jsdom reports every element as 0x0, so the popup needs a size for the clamping
  // logic to have anything to work with.
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const size = this.id === 'autocardPopup' ? popupSize : { width: 100, height: 20 };
    return { ...size, top: 0, left: 0, right: size.width, bottom: size.height, x: 0, y: 0, toJSON: () => ({}) };
  });
});

beforeEach(() => {
  popupSize = { ...POPUP };
  Object.defineProperty(document.documentElement, 'clientWidth', { value: VIEWPORT.width, configurable: true });
  Object.defineProperty(document.documentElement, 'clientHeight', { value: VIEWPORT.height, configurable: true });
  window.innerWidth = VIEWPORT.width;
  window.innerHeight = VIEWPORT.height;
  window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;
});

/** Moves the pointer so the provider records a cursor position, as a real browser would. */
const moveCursorTo = (x: number, y: number) => fireEvent.mouseMove(document, { clientX: x, clientY: y });

describe('autocard previews', () => {
  it('positions the preview next to the cursor when it is shown', () => {
    render(
      <AutocardContextProvider>
        <AutocardDiv card={card}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(100, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));

    expect(isShowing()).toBe(true);
    expect(popupLeft()).toBe(105);
    expect(popupTop()).toBe(105);
  });

  it('positions from the current cursor even when the preview opens without a mouse move', () => {
    // Regression: position was only ever written by a mousemove listener that
    // subscribed after the preview was already visible, so a preview opened by
    // scrolling a card under a resting cursor rendered at the previous coordinates —
    // which, once the page had scrolled, was below the footer.
    render(
      <AutocardContextProvider>
        <AutocardDiv card={card}>Lightning Bolt</AutocardDiv>
        <AutocardDiv card={otherCard}>Ancestral Recall</AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(700, 600);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));
    fireEvent.mouseLeave(screen.getByText('Lightning Bolt'));

    // The cursor has since moved, but the second preview opens with no mousemove of
    // its own — exactly what a scroll under a stationary pointer produces.
    moveCursorTo(120, 90);
    fireEvent.mouseEnter(screen.getByText('Ancestral Recall'));

    expect(isShowing()).toBe(true);
    expect(popupLeft()).toBe(125);
    expect(popupTop()).toBe(95);
  });

  it('keeps the preview inside the viewport near the right and bottom edges', () => {
    render(
      <AutocardContextProvider>
        <AutocardDiv card={card}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(VIEWPORT.width - 20, VIEWPORT.height - 20);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));

    expect(popupLeft() + POPUP.width).toBeLessThanOrEqual(VIEWPORT.width);
    expect(popupTop() + POPUP.height).toBeLessThanOrEqual(VIEWPORT.height);
    expect(popupLeft()).toBeGreaterThanOrEqual(0);
    expect(popupTop()).toBeGreaterThanOrEqual(0);
  });

  it('keeps a double-faced preview inside a narrow desktop viewport', () => {
    // Regression: the side was chosen by comparing the cursor's distance to each edge
    // and ignored the preview's own width, so a 30rem double-faced preview ran off the
    // right edge on viewports between the 768px hover cutoff and ~968px.
    const narrow = 900;
    Object.defineProperty(document.documentElement, 'clientWidth', { value: narrow, configurable: true });
    window.innerWidth = narrow;
    popupSize = { width: 480, height: 334 };

    render(
      <AutocardContextProvider>
        <AutocardDiv card={card}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );

    // Just left of centre: the old midpoint rule placed the preview to the right here.
    moveCursorTo(narrow / 2 - 1, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));

    expect(isShowing()).toBe(true);
    expect(popupLeft()).toBeGreaterThanOrEqual(0);
    expect(popupLeft() + popupSize.width).toBeLessThanOrEqual(narrow);
  });

  it('hides the preview when the trigger unmounts while still hovered', () => {
    // Regression: React fires no mouseleave for an element that no longer exists, so
    // the preview was stranded on screen and then followed the cursor around.
    const Harness: React.FC = () => {
      const [visible, setVisible] = useState(true);
      return (
        <AutocardContextProvider>
          {visible && <AutocardDiv card={card}>Lightning Bolt</AutocardDiv>}
          <button onClick={() => setVisible(false)}>remove</button>
        </AutocardContextProvider>
      );
    };
    render(<Harness />);

    moveCursorTo(100, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));
    expect(isShowing()).toBe(true);

    fireEvent.click(screen.getByText('remove'));
    expect(isShowing()).toBe(false);
  });

  it('hides the preview when the pointer leaves the window', () => {
    render(
      <AutocardContextProvider>
        <AutocardDiv card={card}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(100, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));
    expect(isShowing()).toBe(true);

    // A null relatedTarget is the browser's signal that the pointer left the document.
    fireEvent.mouseOut(document, { relatedTarget: null });
    expect(isShowing()).toBe(false);
  });

  it('hides the preview when the window loses focus', () => {
    render(
      <AutocardContextProvider>
        <AutocardDiv card={card}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(100, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));
    expect(isShowing()).toBe(true);

    fireEvent.blur(window);
    expect(isShowing()).toBe(false);
  });

  it('does not let a superseded trigger dismiss a newer preview', () => {
    const Harness: React.FC = () => {
      const [visible, setVisible] = useState(true);
      return (
        <AutocardContextProvider>
          {visible && <AutocardDiv card={card}>Lightning Bolt</AutocardDiv>}
          <AutocardDiv card={otherCard}>Ancestral Recall</AutocardDiv>
          <button onClick={() => setVisible(false)}>remove</button>
        </AutocardContextProvider>
      );
    };
    render(<Harness />);

    moveCursorTo(100, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));
    fireEvent.mouseLeave(screen.getByText('Lightning Bolt'));
    fireEvent.mouseEnter(screen.getByText('Ancestral Recall'));
    expect(isShowing()).toBe(true);

    // The first trigger unmounts after the second one took over; its cleanup must not
    // dismiss the preview that replaced it.
    fireEvent.click(screen.getByText('remove'));
    expect(isShowing()).toBe(true);
  });

  it('still runs a consumer-supplied onClick and shows the preview on hover', () => {
    // Regression: the prop spread came after the handler props, so a consumer's
    // onClick/onMouseEnter silently replaced the preview's own handlers.
    const onClick = jest.fn();
    const onMouseEnter = jest.fn();
    render(
      <AutocardContextProvider>
        <AutocardDiv card={card} onClick={onClick} onMouseEnter={onMouseEnter}>
          Lightning Bolt
        </AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(100, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));
    expect(onMouseEnter).toHaveBeenCalled();
    expect(isShowing()).toBe(true);

    fireEvent.click(screen.getByText('Lightning Bolt'));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders a long tag value in full inside a bounded rail', () => {
    // Regression: the rail was white-space: nowrap with no width bound, so a long tag
    // value stretched it off the side of the page.
    const longTag = 'Supercalifragilistic Reanimator Combo Enabler Package';
    const tagged = { ...card, tags: [longTag] } as unknown as Card;
    render(
      <AutocardContextProvider>
        <AutocardDiv card={tagged}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(100, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));

    const rail = document.getElementById('autocardTags') as HTMLDivElement;
    expect(rail).toBeInTheDocument();
    // The value is rendered in full rather than being clipped to the rail.
    expect(rail).toHaveTextContent(longTag);
    // The rail is width-bounded so the value has something to wrap within, and nothing
    // in it forces a single line.
    expect(rail.style.width).toBe('160px');
    expect(rail.firstElementChild).toHaveClass('break-words');
    expect((rail.firstElementChild as HTMLElement).style.whiteSpace).not.toBe('nowrap');
  });

  it('keeps the tag rail inside the viewport when the preview is near the right edge', () => {
    const tagged = { ...card, tags: ['Reanimator'] } as unknown as Card;
    render(
      <AutocardContextProvider>
        <AutocardDiv card={tagged}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(VIEWPORT.width - 20, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));

    const rail = document.getElementById('autocardTags') as HTMLDivElement;
    const railLeft = parseFloat(rail.style.left);
    expect(railLeft).toBeGreaterThanOrEqual(0);
    expect(railLeft + 160).toBeLessThanOrEqual(VIEWPORT.width);
  });

  it('does not show a preview when given neither a card nor an image', () => {
    render(
      <AutocardContextProvider>
        <AutocardDiv>Nothing</AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(100, 100);
    expect(() => fireEvent.mouseEnter(screen.getByText('Nothing'))).not.toThrow();
    expect(isShowing()).toBe(false);
  });

  it('does not show previews on a device with no hover-capable pointer', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as any;
    render(
      <AutocardContextProvider>
        <AutocardDiv card={card}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(100, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));
    expect(isShowing()).toBe(false);
  });
});
