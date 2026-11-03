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
// Every non-popup element, including the tag rail, measures this in the stub below.
const ELEMENT = { width: 100, height: 20 };
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
    const size = this.id === 'autocardPopup' ? popupSize : ELEMENT;
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
    // The rail is bounded rather than fixed-width, so short tags keep a narrow rail and
    // long ones have something to wrap within.
    expect(rail.style.maxWidth).toBe('160px');
    expect(rail.style.width).toBe('');
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
    expect(railLeft + ELEMENT.width).toBeLessThanOrEqual(VIEWPORT.width);
  });

  it('rounds every corner of both faces of a double-faced preview', () => {
    // Regression: the faces were rounded only along their bottom edge, and the card
    // radius sat on a wrapper div that never clipped anything (no overflow: hidden).
    // Only the popup's own overflow rounded the outer corners, so the two faces met in
    // a square seam that exposed the white corner the Scryfall JPEG bakes in.
    const dfc = {
      ...card,
      details: { ...card.details, image_flip: 'https://example.com/bolt-back.jpg' },
    } as unknown as Card;
    render(
      <AutocardContextProvider>
        <AutocardDiv card={dfc}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(100, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));

    const popup = document.getElementById('autocardPopup') as HTMLDivElement;
    expect(popup).toHaveStyle({ width: '30rem' });

    const faces = [
      document.getElementById('autocardImageFront'),
      document.getElementById('autocardImageBack'),
    ] as HTMLImageElement[];
    for (const face of faces) {
      // card-border carries the full card radius and, on an img, actually clips it.
      expect(face).toHaveClass('card-border');
      expect(face).not.toHaveClass('rounded-b-md');
      expect(face.parentElement).not.toHaveClass('card-border');
    }
  });

  it('gives an Alpha printing its rounder corner radius', () => {
    // Alpha was cut with rounder corners than later sets, and Scryfall's image preserves
    // that; the default radius would clip inside the corner baked into the image.
    const alpha = { ...card, details: { ...card.details, set: 'lea' } } as unknown as Card;
    render(
      <AutocardContextProvider>
        <AutocardDiv card={alpha}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(100, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));

    const face = document.getElementById('autocardImageFront') as HTMLImageElement;
    expect(face).toHaveClass('card-border');
    expect(face).toHaveClass('card-border-alpha');
  });

  it('leaves a non-Alpha printing on the default corner radius', () => {
    const beta = { ...card, details: { ...card.details, set: 'leb' } } as unknown as Card;
    render(
      <AutocardContextProvider>
        <AutocardDiv card={beta}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );

    moveCursorTo(100, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));

    const face = document.getElementById('autocardImageFront') as HTMLImageElement;
    expect(face).toHaveClass('card-border');
    expect(face).not.toHaveClass('card-border-alpha');
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

describe('landscape previews', () => {
  // Cards printed sideways — Planes, Phenomena, Schemes, old split cards, and the front
  // face of a Battle. Scryfall still ships them 488x680 portrait, so the preview rotates
  // them and the popup has to reserve the wider box.
  const plane = {
    ...card,
    details: { ...card.details, layout: 'planar' },
  } as unknown as Card;

  const battle = {
    ...card,
    details: {
      ...card.details,
      layout: 'transform',
      type: 'Battle — Siege',
      image_flip: 'https://example.com/bolt-back.jpg',
    },
  } as unknown as Card;

  const landscapeFrame = (id: string) => document.getElementById(id)!.closest('[style*="680 / 488"]');

  const hover = (preview: Card) => {
    render(
      <AutocardContextProvider>
        <AutocardDiv card={preview}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );
    moveCursorTo(100, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));
  };

  it('sizes a single portrait preview to one face', () => {
    hover(card);
    expect(popup()).toHaveStyle({ width: '15rem' });
    expect(landscapeFrame('autocardImageFront')).toBeNull();
  });

  it('sizes a two-portrait-face preview to two faces', () => {
    const dfc = {
      ...card,
      details: { ...card.details, layout: 'transform', image_flip: 'https://example.com/bolt-back.jpg' },
    } as unknown as Card;
    hover(dfc);
    expect(popup()).toHaveStyle({ width: '30rem' });
    expect(landscapeFrame('autocardImageFront')).toBeNull();
    expect(landscapeFrame('autocardImageBack')).toBeNull();
  });

  it('sizes a landscape preview to the rotated face width', () => {
    hover(plane);
    expect(popup()).toHaveStyle({ width: '20.9016rem' });
    expect(landscapeFrame('autocardImageFront')).not.toBeNull();
  });

  it('sizes a battle preview to a landscape front beside a portrait back', () => {
    hover(battle);
    expect(popup()).toHaveStyle({ width: '35.9016rem' });
    expect(landscapeFrame('autocardImageFront')).not.toBeNull();
    expect(landscapeFrame('autocardImageBack')).toBeNull();
  });

  it('tops the faces rather than stretching the landscape one', () => {
    // The row defaults to items-stretch, which overrides the landscape frame's
    // aspect-ratio: beside a Battle's taller portrait back, the rotated front would
    // float mid-column with accent background above and below it.
    hover(battle);

    const row = document.getElementById('autocardImageFront')!.closest('.flex') as HTMLElement;
    expect(row).toHaveClass('items-start');
    expect(row).not.toHaveClass('items-stretch');
  });

  it('keeps a landscape preview inside the viewport near the right edge', () => {
    // The landscape popup is ~40% wider than a portrait one; the clamp has to measure
    // the box it actually reserves rather than assume 15rem.
    popupSize = { width: 334, height: 240 };

    render(
      <AutocardContextProvider>
        <AutocardDiv card={plane}>Lightning Bolt</AutocardDiv>
      </AutocardContextProvider>,
    );
    moveCursorTo(VIEWPORT.width - 20, 100);
    fireEvent.mouseEnter(screen.getByText('Lightning Bolt'));

    expect(isShowing()).toBe(true);
    expect(popupLeft()).toBeGreaterThanOrEqual(0);
    expect(popupLeft() + popupSize.width).toBeLessThanOrEqual(VIEWPORT.width);
  });
});
