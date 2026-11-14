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

const exportLinks = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLAnchorElement>('a[href*="/cube/download/"]'),
];

const exportHrefs = (container: HTMLElement) => exportLinks(container).map((link) => link.href);

const exportParams = (container: HTMLElement) =>
  exportLinks(container).map((link) => new URL(link.href, 'http://localhost').searchParams);

describe('CubeHero export links', () => {
  it("are unaffected by the page's show unsorted toggle", () => {
    const { container } = renderHero();

    const before = exportHrefs(container);
    expect(before.length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('Show Unsorted cards')[0]!);

    expect(exportHrefs(container)).toEqual(before);
  });

  it('always ask for the fixed sort and for unsorted cards', () => {
    const { container } = renderHero();
    const params = exportParams(container);

    expect(params.length).toBeGreaterThan(0);
    expect(new Set(params.map((p) => p.get('primary')))).toEqual(new Set(['Color Category']));
    expect(new Set(params.map((p) => p.get('showother')))).toEqual(new Set(['true']));
  });

  it('no longer offer a Use Sort checkbox', () => {
    renderHero();

    expect(screen.queryByText('Use Sort')).not.toBeInTheDocument();
    expect(screen.getAllByText('Use Filter').length).toBeGreaterThan(0);
  });
});
