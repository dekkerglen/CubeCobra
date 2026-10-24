import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card from '@utils/datatypes/Card';
import { DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';

import AutocardListItem from 'components/card/AutocardListItem';
import DisplayContext from 'contexts/DisplayContext';
import TagColorContext from 'contexts/TagColorContext';

jest.mock('components/cubetray/useCubeTrayDrag', () => ({
  __esModule: true,
  default: () => ({ active: false }),
}));

const card = {
  cardID: 'bolt',
  index: 0,
  board: 'mainboard',
  tags: ['Burn'],
  details: { name: 'Lightning Bolt', scryfall_id: 'bolt', type: 'Instant', color_identity: ['R'], colors: ['R'] },
} as unknown as Card;

beforeAll(() => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as any;
});

const renderItem = (showTagColors: boolean) =>
  render(
    <DisplayContext.Provider value={{ displayOptions: { ...DEFAULT_CUBE_DISPLAY_OPTIONS, showTagColors } } as any}>
      <TagColorContext.Provider value={[{ tag: 'Burn', color: 'red' }]}>
        <AutocardListItem card={card} noCardModal />
      </TagColorContext.Provider>
    </DisplayContext.Provider>,
  );

describe('AutocardListItem tag colors', () => {
  it('shows tag colors when the page shows them', () => {
    renderItem(true);
    expect(screen.getByText('Lightning Bolt').closest('.list-group-card')).toHaveClass('tag-red');
  });

  it('hides tag colors when the page hides them', () => {
    renderItem(false);
    expect(screen.getByText('Lightning Bolt').closest('.list-group-card')).not.toHaveClass('tag-red');
  });
});
