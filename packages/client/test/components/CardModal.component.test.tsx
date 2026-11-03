import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { detailsToCard } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';

import CardModal from 'components/card/CardModal';
import { AutocardContextProvider } from 'contexts/AutocardContext';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

jest.mock('components/modals/AddToCubeModal', () => ({ __esModule: true, default: () => <div /> }));
jest.mock('components/purchase/PurchaseTable', () => ({ __esModule: true, default: () => <div /> }));
jest.mock('components/ImageUploadWidget', () => ({ __esModule: true, default: () => <div /> }));

const cardWith = (overrides: Partial<ReturnType<typeof getPlaceholderCardDetails>>): Card => {
  const card = detailsToCard({
    ...getPlaceholderCardDetails('scryfall-id'),
    name: 'Delver of Secrets',
    ...overrides,
  });
  return { ...card, index: 0, board: 'mainboard' };
};

const props = {
  isOpen: true,
  setOpen: jest.fn(),
  canEdit: false,
  versionDict: {},
  fetchVersionsForCard: jest.fn().mockResolvedValue(true),
  editCard: jest.fn(),
  revertEdit: jest.fn(),
  revertRemove: jest.fn(),
  removeCard: jest.fn(),
  tagColors: [],
  moveCard: jest.fn(),
  allTags: [],
};

describe('card modal face toggle', () => {
  it('offers no face toggle for a card with a single face', () => {
    render(<CardModal {...props} card={cardWith({ layout: 'normal' })} />);

    expect(screen.queryByRole('button', { name: /transform|turn over/i })).not.toBeInTheDocument();
  });

  it('calls it a transform only when the card actually transforms', () => {
    render(<CardModal {...props} card={cardWith({ layout: 'transform', image_flip: 'back.jpg' })} />);

    expect(screen.getByRole('button', { name: 'Transform' })).toBeInTheDocument();
  });

  it.each([['modal_dfc'], ['double_faced_token'], ['reversible_card']])(
    'calls it a turn over for %s, which has two faces but never transforms',
    (layout) => {
      render(<CardModal {...props} card={cardWith({ layout, image_flip: 'back.jpg' })} />);

      expect(screen.getByRole('button', { name: 'Turn Over' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Transform' })).not.toBeInTheDocument();
    },
  );

  it('stays neutral when the back is a custom image on a card that cannot transform', () => {
    const card = { ...cardWith({ layout: 'normal' }), imgBackUrl: 'https://example.test/custom-back.png' };

    render(<CardModal {...props} card={card} />);

    expect(screen.getByRole('button', { name: 'Turn Over' })).toBeInTheDocument();
  });

  it('carries no direction suffix, matching the card analytics page', () => {
    render(<CardModal {...props} card={cardWith({ layout: 'transform', image_flip: 'back.jpg' })} />);
    const toggle = screen.getByRole('button', { name: 'Transform' });

    expect(toggle).toHaveTextContent(/^Transform$/);
    expect(toggle).not.toHaveTextContent(/To back|To front/);
  });

  it('keeps the label steady once the other face is showing', () => {
    render(<CardModal {...props} card={cardWith({ layout: 'transform', image_flip: 'back.jpg' })} />);
    const toggle = screen.getByRole('button', { name: 'Transform' });

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Transform' })).toHaveTextContent(/^Transform$/);
  });
});

describe('card modal corner radius', () => {
  // Regression: the modal composes FoilOverlay(ImageFallback) directly rather than going
  // through CardImage, so an Alpha printing kept the default radius and showed the white
  // corner baked into Scryfall's image.
  const imageOf = (card: Card) => {
    render(<CardModal {...props} card={card} />);
    return screen.getByAltText('Delver of Secrets');
  };

  it('gives an Alpha printing its rounder corner radius', () => {
    expect(imageOf(cardWith({ set: 'lea' }))).toHaveClass('card-border-alpha');
  });

  it('leaves a non-Alpha printing on the default corner radius', () => {
    expect(imageOf(cardWith({ set: 'leb' }))).not.toHaveClass('card-border-alpha');
  });

  it('does not leak the card object onto the rendered img', () => {
    // ImageFallback spreads its remaining props onto the <img>, so `card` has to be
    // destructured out or React warns about an unknown DOM attribute.
    expect(imageOf(cardWith({ set: 'lea' })).hasAttribute('card')).toBe(false);
  });
});

describe('landscape card images', () => {
  const landscapeFrameAround = (image: HTMLElement) => image.closest('[style*="680 / 488"]');

  it('wraps a planar card image in a landscape frame', () => {
    render(<CardModal {...props} card={cardWith({ layout: 'planar' })} />);

    expect(landscapeFrameAround(screen.getByAltText('Delver of Secrets'))).not.toBeNull();
  });

  it('leaves an ordinary card unwrapped', () => {
    render(<CardModal {...props} card={cardWith({ layout: 'normal' })} />);

    expect(landscapeFrameAround(screen.getByAltText('Delver of Secrets'))).toBeNull();
  });

  it('reflows to portrait when a battle is turned over', () => {
    // A Battle is a transform card with a landscape front and an ordinary portrait back,
    // so the box has to change shape with the face.
    render(
      <CardModal {...props} card={cardWith({ layout: 'transform', type: 'Battle — Siege', image_flip: 'back.jpg' })} />,
    );

    expect(landscapeFrameAround(screen.getByAltText('Delver of Secrets'))).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Transform' }));

    expect(landscapeFrameAround(screen.getByAltText('Delver of Secrets'))).toBeNull();
  });

  it('raises the autocard preview when a landscape image is hovered', () => {
    // The modal panel is overflow-hidden, so an in-place expansion would be clipped.
    // The autocard popup is already fixed-position and viewport-clamped.
    render(
      <AutocardContextProvider>
        <CardModal {...props} card={cardWith({ layout: 'planar' })} />
      </AutocardContextProvider>,
    );

    const frame = landscapeFrameAround(screen.getByAltText('Delver of Secrets')) as HTMLElement;
    // The provider positions from the recorded pointer, so without a move it has
    // nowhere to place the preview and leaves it hidden.
    fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
    fireEvent.mouseEnter(frame);

    expect((document.getElementById('autocardPopup') as HTMLDivElement).style.visibility).toBe('visible');
  });

  it('does not raise a preview from a portrait image', () => {
    render(
      <AutocardContextProvider>
        <CardModal {...props} card={cardWith({ layout: 'normal' })} />
      </AutocardContextProvider>,
    );

    fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
    fireEvent.mouseEnter(screen.getByAltText('Delver of Secrets'));

    expect((document.getElementById('autocardPopup') as HTMLDivElement).style.visibility).toBe('hidden');
  });
});
