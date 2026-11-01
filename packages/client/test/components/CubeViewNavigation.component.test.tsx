import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import CubeSidebar from 'components/cube/CubeSidebar';
import MobileSubNav from 'components/cube/MobileSubNav';
import CubeContext from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';

const view = (name: string) => ({
  name,
  boards: ['mainboard'],
  displayView: 'table' as const,
  defaultSorts: ['Color Category', 'Types-Multicolor', 'Mana Value', 'Alphabetical'],
});

// "R&D" is the interesting case: its name contains a character that has meaning in
// a query string, so any surface that hand-builds `?view=<name>` produces a dead link.
// "Loreseeker/Booster Tutor" combines a slash with spaces — a real view name that the
// previous percent-encoded key turned into `?view=loreseeker%252Fbooster-tutor`.
const cube = {
  id: 'c1',
  shortId: 'c1',
  views: [view('Mainboard'), view('Base Packs'), view('R&D'), view('Loreseeker/Booster Tutor')],
} as Cube;

// Both navs read the cube's cards from context to count what each view holds. Every view
// above shows the mainboard, so each one renders the same count beside its name.
const CARD_COUNT = 3;
const unfilteredChangedCards = {
  mainboard: new Array(CARD_COUNT).fill({}),
  maybeboard: [{}],
};

const renderNav = (ui: React.ReactElement, search = '') => {
  window.history.replaceState({}, '', `/cube/list/c1${search}`);
  const cubeValue = { cube, canEdit: false, unfilteredChangedCards } as any;
  return render(
    <CubeContext.Provider value={cubeValue}>
      <DisplayContextProvider cubeID="c1" viewSlugs={['mainboard', 'base-packs', 'r-d', 'loreseeker-booster-tutor']}>
        {ui}
      </DisplayContextProvider>
    </CubeContext.Provider>,
  );
};

const viewParam = () => new URLSearchParams(window.location.search).get('view');

// A view link is "<view name><card count>", with the count in a trailing element. Strip it
// so links can still be found by the view name alone.
const linkName = (link: HTMLElement): string => {
  const text = link.textContent ?? '';
  const badge = link.lastElementChild?.textContent ?? '';
  return badge && text.endsWith(badge) ? text.slice(0, -badge.length) : text;
};

// jsdom has no ResizeObserver; the sidebar's scroll-shadow container constructs one on mount.
beforeAll(() => {
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe.each([
  [
    'CubeSidebar',
    () => <CubeSidebar cube={cube} activeLink="list" />,
    (el: HTMLElement) => el.className.includes('font-bold'),
  ],
  [
    'MobileSubNav',
    () => <MobileSubNav cube={cube} activeLink="list" />,
    (el: HTMLElement) => !el.className.includes('text-text-secondary'),
  ],
])('%s view navigation', (_name, ui, isActive) => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/cube/list/c1');
  });

  const linksNamed = (name: string) => screen.getAllByRole('link').filter((link) => linkName(link) === name);

  it('links a view with special characters to its slug', () => {
    renderNav(ui());
    const links = linksNamed('R&D');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/cube/list/c1?view=r-d');
    }
  });

  it('shows how many cards each view holds', () => {
    renderNav(ui());
    const links = linksNamed('R&D');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.lastElementChild).toHaveTextContent(String(CARD_COUNT));
    }
  });

  it('writes the slug to the URL when a view is selected', () => {
    renderNav(ui());
    fireEvent.click(linksNamed('R&D')[0]!);
    expect(viewParam()).toBe('r-d');
  });

  it('writes the slug for a multi-word view name', () => {
    renderNav(ui());
    fireEvent.click(linksNamed('Base Packs')[0]!);
    expect(viewParam()).toBe('base-packs');
  });

  it('round trips a view name combining a slash and spaces', () => {
    renderNav(ui());
    const name = 'Loreseeker/Booster Tutor';
    expect(linksNamed(name)[0]!).toHaveAttribute('href', '/cube/list/c1?view=loreseeker-booster-tutor');

    fireEvent.click(linksNamed(name)[0]!);

    expect(viewParam()).toBe('loreseeker-booster-tutor');
    expect(window.location.search).toBe('?view=loreseeker-booster-tutor');
    for (const link of linksNamed(name)) {
      expect(isActive(link)).toBe(true);
    }
  });

  it('marks the view named by the URL slug as active', () => {
    renderNav(ui(), '?view=r-d');
    expect(linksNamed('R&D').length).toBeGreaterThan(0);
    for (const link of linksNamed('R&D')) {
      expect(isActive(link)).toBe(true);
    }
    for (const link of linksNamed('Base Packs')) {
      expect(isActive(link)).toBe(false);
    }
  });

  it('marks the right view active for a legacy link carrying the display name', () => {
    renderNav(ui(), `?view=${encodeURIComponent('R&D')}`);
    expect(linksNamed('R&D').length).toBeGreaterThan(0);
    for (const link of linksNamed('R&D')) {
      expect(isActive(link)).toBe(true);
    }
  });
});
