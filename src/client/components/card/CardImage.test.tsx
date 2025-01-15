import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { defaultDisplayContext } from 'src/test-utils/context';
import { createCard, createCardDetails } from 'src/test-utils/data';

import '@testing-library/jest-dom';

import { cardImageUrl } from 'utils/cardutil';

import DisplayContext from '../../contexts/DisplayContext';
import CardImage from './CardImage';

jest.mock('utils/cardutil', () => ({
  cardImageUrl: jest.fn(),
}));

describe('CardImage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const card = createCard({ details: createCardDetails({ image_normal: 'image.png', name: 'My Card' }) });

    render(<CardImage card={card} />);
    const image = screen.getByAltText('My Card');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'image.png');
  });

  it('uses the fallback image when not provided', () => {
    const card = createCard({ details: createCardDetails({ name: 'My Card' }) });

    render(<CardImage card={card} />);

    const image = screen.getByAltText('My Card');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/content/default_card.png');
  });

  it('calls onClick when the image is clicked', () => {
    const handleClick = jest.fn();

    render(<CardImage onClick={handleClick} />);

    const image = screen.getByRole('img');

    fireEvent.click(image);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders with custom image when available and showCustomImages is true', () => {
    (cardImageUrl as jest.Mock).mockReturnValue('/mock/custom-image.png');

    const card = createCard();

    render(
      <DisplayContext.Provider value={{ ...defaultDisplayContext, showCustomImages: true }}>
        <CardImage card={card}/>
      </DisplayContext.Provider>
    );

    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('src', '/mock/custom-image.png');
    expect(cardImageUrl).toHaveBeenCalledWith(card);
  })
});
