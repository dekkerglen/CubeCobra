import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card from '@utils/datatypes/Card';

import AutocardListItem from 'components/card/AutocardListItem';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';
import TagColorContext from 'contexts/TagColorContext';
import UserContext from 'contexts/UserContext';

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

const renderItem = ({ hideTagColors, showTagColors }: { hideTagColors: boolean; showTagColors: boolean }) =>
  render(
    <UserContext.Provider value={{ id: 'u1', hideTagColors } as any}>
      <CubeContext.Provider value={{ showTagColors } as any}>
        <DisplayContext.Provider value={{ showInlineTagEmojis: false } as any}>
          <TagColorContext.Provider value={[{ tag: 'Burn', color: 'red' }]}>
            <AutocardListItem card={card} noCardModal />
          </TagColorContext.Provider>
        </DisplayContext.Provider>
      </CubeContext.Provider>
    </UserContext.Provider>,
  );

describe('AutocardListItem tag colors', () => {
  it('shows tag colors once they are toggled on in-page, even though the loaded user had them hidden', () => {
    renderItem({ hideTagColors: true, showTagColors: true });
    expect(screen.getByText('Lightning Bolt').closest('.list-group-card')).toHaveClass('tag-red');
  });

  it('hides tag colors once they are toggled off in-page, even though the loaded user had them shown', () => {
    renderItem({ hideTagColors: false, showTagColors: false });
    expect(screen.getByText('Lightning Bolt').closest('.list-group-card')).not.toHaveClass('tag-red');
  });
});
