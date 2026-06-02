import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { cardImageUrl } from '@utils/cardutil';

import '@testing-library/jest-dom';

import CardImage from 'components/card/CardImage';
import DisplayContext from 'contexts/DisplayContext';

import { defaultDisplayContext } from '../../../server/test/test-utils/context';
import { createCard, createCardDetails } from '../../../server/test/test-utils/data';

jest.mock('@utils/cardutil', () => ({
  cardImageUrl: jest.fn(),
  cardName: jest.fn((card) => card.details?.name ?? ''),
}));

// ImageFallback preloads the real src via `new Image()` and swaps once onload
// fires. JSDOM never actually loads images, so the visible <img> would otherwise
// stay stuck on the loading placeholder. Stub Image so onload fires synchronously
// in tests and the real src lands on the rendered element.
beforeAll(() => {
  Object.defineProperty(window, 'Image', {
    writable: true,
    configurable: true,
    value: class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        // Fire onload on the next microtask so the React state update happens
        // inside an act() boundary the way it would on a real browser.
        Promise.resolve().then(() => this.onload && this.onload());
      }
    },
  });
});

describe('CardImage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    const card = createCard({ details: createCardDetails({ image_normal: 'image.png', name: 'My Card' }) });

    render(<CardImage card={card} />);
    const image = screen.getByAltText('My Card');
    expect(image).toBeInTheDocument();
    await waitFor(() => expect(image).toHaveAttribute('src', 'image.png'));
  });

  it('uses the fallback image when not provided', () => {
    const card = createCard({ details: createCardDetails({ name: 'My Card' }) });

    render(<CardImage card={card} />);

    const image = screen.getByAltText('My Card');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/content/loadingcard.png');
  });

  it('calls onClick when the image is clicked', () => {
    const handleClick = jest.fn();
    const card = createCard({ details: createCardDetails({ name: 'Test Card' }) });

    render(<CardImage card={card} onClick={handleClick} />);

    const image = screen.getByRole('img');

    fireEvent.click(image);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders with custom image when available and showCustomImages is true', async () => {
    (cardImageUrl as jest.Mock).mockReturnValue('/mock/custom-image.png');

    const card = createCard();

    render(
      <DisplayContext.Provider value={{ ...defaultDisplayContext, showCustomImages: true }}>
        <CardImage card={card} />
      </DisplayContext.Provider>,
    );

    const image = screen.getByRole('img');
    await waitFor(() => expect(image).toHaveAttribute('src', '/mock/custom-image.png'));
    expect(cardImageUrl).toHaveBeenCalledWith(card);
  });
});
