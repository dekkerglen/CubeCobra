import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';

import CubeHero from 'components/cube/CubeHero';
import SortCollapse from 'components/SortCollapse';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import FilterContext from 'contexts/FilterContext';

import { createCube, createUser } from '../../../server/test/test-utils/data';

// The export links live inside a dropdown that only mounts its children once opened. Rendering the
// menu unconditionally keeps the test about the link parameters rather than menu interaction.
jest.mock('components/base/Dropdown', () => ({
  __esModule: true,
  default: ({ trigger, children }: any) => (
    <div>
      {trigger}
      {children}
    </div>
  ),
}));

// Pulled in via the overview editor; its markdown stack is ESM-only and irrelevant here.
jest.mock('components/Markdown', () => ({
  __esModule: true,
  SafeMarkdown: () => <div />,
  default: () => <div />,
}));

// The Print-and-Play modal pulls in jsPDF, which needs browser globals jsdom does not provide. The
// Arena modal builds its export eagerly on mount; neither is what this test is about.
jest.mock('components/modals/PrintAndPlayExportModal', () => ({ __esModule: true, default: () => <div /> }));
jest.mock('components/modals/ArenaExportModal', () => ({ __esModule: true, default: () => <div /> }));

const owner = createUser({ id: 'owner-1' });
const cube = createCube({ id: 'cube-1', owner, showUnsorted: false });

const renderHero = () =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 't', csrfFetch: jest.fn(), callApi: jest.fn() } as any}>
      <DisplayContextProvider cubeID={cube.id} savedDisplayOptions={DEFAULT_CUBE_DISPLAY_OPTIONS}>
        <FilterContext.Provider value={{ filterInput: '', cardFilter: { filter: null } } as any}>
          <CubeContext.Provider
            value={
              {
                cube,
                sortPrimary: 'Color Category',
                sortSecondary: 'Types-Multicolor',
                sortTertiary: 'Mana Value',
                sortQuaternary: 'Alphabetical',
                effectiveDefaultSorts: [],
                resetSorts: jest.fn(),
                unfilteredChangedCards: { mainboard: [] },
              } as any
            }
          >
            <CubeHero cube={cube} />
            <SortCollapse isOpen />
          </CubeContext.Provider>
        </FilterContext.Provider>
      </DisplayContextProvider>
    </CSRFContext.Provider>,
  );

const showotherParams = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLAnchorElement>('a[href*="/cube/download/"]')].map((link) =>
    new URL(link.href, 'http://localhost').searchParams.get('showother'),
  );

describe('CubeHero export links', () => {
  it('tracks the live "show unsorted" display toggle rather than the cube\'s saved setting', () => {
    const { container } = renderHero();

    const before = showotherParams(container);
    expect(before.length).toBeGreaterThan(0);
    expect(new Set(before)).toEqual(new Set(['false']));

    // Toggling the page's display option must change the export links, because that toggle is what
    // decides whether the cube page is showing the "Other" group.
    fireEvent.click(screen.getAllByText('Show Unsorted cards')[0]!);

    expect(new Set(showotherParams(container))).toEqual(new Set(['true']));
  });
});
