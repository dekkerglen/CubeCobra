import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card from '@utils/datatypes/Card';

import SwapStackTile from 'components/blog/SwapStackTile';
import { AutocardContextProvider } from 'contexts/AutocardContext';

const oldCard = {
  cardID: 'old-id',
  details: { name: 'Paradise Plume', image_normal: 'old.jpg' },
} as unknown as Card;

const card = {
  cardID: 'new-id',
  details: { name: 'Evangelize', image_normal: 'new.jpg' },
} as unknown as Card;

// The "Added" badge sits inside the incoming link, so its aria-label is part of that link's accessible name.
const renderTile = () =>
  render(
    <AutocardContextProvider>
      <SwapStackTile oldCard={oldCard} card={card} />
    </AutocardContextProvider>,
  );

beforeEach(() => {
  window.innerWidth = 1200;
  window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;
});

describe('SwapStackTile', () => {
  it('links each card to its own card page', () => {
    renderTile();

    expect(screen.getByRole('link', { name: 'Paradise Plume Removed' })).toHaveAttribute('href', '/tool/card/old-id');
    expect(screen.getByRole('link', { name: 'Evangelize Added' })).toHaveAttribute('href', '/tool/card/new-id');
  });

  it('puts the incoming card in front', () => {
    renderTile();

    const outgoing = screen.getByRole('link', { name: 'Paradise Plume Removed' });
    const incoming = screen.getByRole('link', { name: 'Evangelize Added' });

    expect(outgoing.compareDocumentPosition(incoming) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hovering the tile previews both cards side by side', () => {
    renderTile();

    fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Paradise Plume Removed' }).parentElement!);

    expect(document.getElementById('autocardImageFront')).toHaveAttribute('src', 'old.jpg');
    expect(document.getElementById('autocardImageBack')).toHaveAttribute('src', 'new.jpg');
  });

  it('marks the incoming card added and the outgoing card removed', () => {
    renderTile();

    const added = screen.getAllByLabelText('Added');
    const removed = screen.getAllByLabelText('Removed');

    expect(added).toHaveLength(1);
    expect(removed).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Evangelize Added' })).toContainElement(added[0]);
    expect(screen.getByRole('link', { name: 'Paradise Plume Removed' })).toContainElement(removed[0]);
  });
});
