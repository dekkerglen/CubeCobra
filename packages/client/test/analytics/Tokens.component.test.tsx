import React from 'react';

import { render } from '@testing-library/react';

import '@testing-library/jest-dom';

import CardType from '@utils/datatypes/Card';

import CubeContext from 'contexts/CubeContext';

import Tokens from '../../src/analytics/Tokens';

jest.mock('components/Markdown', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));

const token = (overrides: Record<string, unknown> = {}) =>
  ({
    cardID: 'token-1',
    details: {
      name: 'Angel',
      oracle_id: 'oracle-angel',
      image_normal: 'https://img.example/angel.png',
      set: 'tsnc',
      collector_number: '2',
      colors: [],
      color_identity: [],
      prices: {},
      type: 'Token Creature — Angel',
      ...(overrides as Record<string, unknown>),
    },
  }) as unknown as CardType;

const sourceCard = () =>
  ({
    cardID: 'source-1',
    index: 0,
    board: 'mainboard',
    details: { name: 'Elspeth', colors: [], type: 'Planeswalker', tokens: ['token-1'] },
  }) as unknown as CardType;

const renderTokens = (tokenCard: CardType) =>
  render(
    <CubeContext.Provider
      value={{ cube: { id: 'cube-1', name: 'Test Cube' }, changedCards: { mainboard: [sourceCard()] } } as any}
    >
      <Tokens tokenMap={{ 'token-1': tokenCard }} />
    </CubeContext.Provider>,
  );

describe('Tokens analysis view', () => {
  it('renders the token image with the shared card border', () => {
    const { container } = renderTokens(token());
    const img = container.querySelector('img[alt="Angel"]');
    expect(img).toBeInTheDocument();
    expect(img).toHaveClass('card-border');
  });

  it('uses the rounder Alpha corners for an Alpha printing', () => {
    const { container } = renderTokens(token({ set: 'lea' }));
    expect(container.querySelector('img[alt="Angel"]')).toHaveClass('card-border-alpha');
  });

  it('does not use the Alpha corners for a normal printing', () => {
    const { container } = renderTokens(token());
    expect(container.querySelector('img[alt="Angel"]')).not.toHaveClass('card-border-alpha');
  });
});
