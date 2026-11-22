import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import { CompareSet, CompareSides } from 'components/compare/CompareArt';
import CompareHeader from 'components/compare/CompareHeader';
import DisplayContext from 'contexts/DisplayContext';

import { defaultDisplayContext } from '../../../server/test/test-utils/context';

jest.mock('components/compare/CompareHero', () => () => <div />);
jest.mock('components/cube/CubeFilterInput', () => () => <div />);
jest.mock('components/SortCollapse', () => () => <div />);
jest.mock('components/modals/TagColorsModal', () => () => <div />);

const side = (title: string) => ({
  kicker: title,
  title,
  image: { uri: '', artist: '', id: '', imageName: '' },
  cardCount: 0,
});

const sides: CompareSides = {
  a: side('A'),
  b: side('B'),
  captions: { onlyA: 'Only in A', both: 'In both', onlyB: 'Only in B' },
};

const cube = { name: 'Cube' } as unknown as Cube;

const renderHeader = (focus: CompareSet | null, displayView = 'table') =>
  render(
    <DisplayContext.Provider value={{ ...defaultDisplayContext, displayView }}>
      <CompareHeader
        sides={sides}
        shared={0}
        focus={focus}
        setFocus={jest.fn()}
        cubeA={cube}
        cubeB={cube}
        cards={[]}
        both={[]}
        onlyA={[]}
        onlyB={[]}
      />
    </DisplayContext.Provider>,
  );

describe('CompareHeader', () => {
  it('shows the view switcher only when a segment is selected', () => {
    const { unmount } = renderHeader(null);
    expect(screen.queryByRole('button', { name: 'Table View' })).toBeNull();
    unmount();

    renderHeader('both');
    expect(screen.getByRole('button', { name: 'Table View' })).toBeInTheDocument();
  });

  it('does not offer the List view', () => {
    renderHeader('both');

    expect(screen.queryByRole('button', { name: 'List View' })).toBeNull();
  });

  it('shows cards-per-row only for the spoiler view', () => {
    const { unmount } = renderHeader('both', 'spoiler');
    expect(screen.getByDisplayValue('5 Cards Per Row')).toBeInTheDocument();
    unmount();

    renderHeader('both', 'table');
    expect(screen.queryByDisplayValue('5 Cards Per Row')).toBeNull();
  });

  it('highlights Table View when the display view is one the switcher does not offer', () => {
    renderHeader('both', 'list');

    expect(screen.getByRole('button', { name: 'Table View' })).toHaveAttribute('aria-pressed', 'true');
  });
});
