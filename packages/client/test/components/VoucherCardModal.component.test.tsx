import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { detailsToCard } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';

import VoucherCardModal from 'components/card/VoucherCardModal';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

jest.mock('components/modals/AddToCubeModal', () => ({ __esModule: true, default: () => <div /> }));
jest.mock('components/purchase/PurchaseTable', () => ({ __esModule: true, default: () => <div /> }));
jest.mock('components/ImageUploadWidget', () => ({ __esModule: true, default: () => <div /> }));

// The voucher's card list renders autocards, which probe the pointer type; jsdom has no matchMedia.
beforeAll(() => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }) as any;
});

const voucherWith = (overrides: Partial<ReturnType<typeof getPlaceholderCardDetails>>): Card => {
  const card = detailsToCard({
    ...getPlaceholderCardDetails('scryfall-id'),
    name: 'Seeded Voucher',
    ...overrides,
  });
  return { ...card, index: 0, board: 'mainboard' };
};

const props = {
  isOpen: true,
  setOpen: jest.fn(),
  canEdit: true,
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

describe('voucher card modal face toggle', () => {
  it('calls it a transform only when the card actually transforms', () => {
    render(<VoucherCardModal {...props} card={voucherWith({ layout: 'transform', image_flip: 'back.jpg' })} />);

    expect(screen.getByRole('button', { name: /^Transform/ })).toBeInTheDocument();
  });

  it.each([['modal_dfc'], ['double_faced_token'], ['reversible_card']])(
    'calls it a turn over for %s, which has two faces but never transforms',
    (layout) => {
      render(<VoucherCardModal {...props} card={voucherWith({ layout, image_flip: 'back.jpg' })} />);

      expect(screen.getByRole('button', { name: /^Turn Over/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Transform/ })).not.toBeInTheDocument();
    },
  );

  it('stays neutral for a custom back image, the common case for a voucher', () => {
    const card = { ...voucherWith({ layout: 'normal' }), imgBackUrl: 'https://example.test/custom-back.png' };

    render(<VoucherCardModal {...props} card={card} />);

    expect(screen.getByRole('button', { name: /^Turn Over/ })).toBeInTheDocument();
  });
});
