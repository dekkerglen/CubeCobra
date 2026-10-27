import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { detailsToCard } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';

import CardModal from 'components/card/CardModal';
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
