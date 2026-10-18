import React, { useContext } from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import { CSRFContext } from 'contexts/CSRFContext';
import DisplayContext from 'contexts/DisplayContext';
import CubeLayout from 'layouts/CubeLayout';

jest.mock('components/Banner', () => () => <div />);
jest.mock('components/cube/CubeHero', () => () => <div />);
jest.mock('components/cube/CubeSidebar', () => () => <div />);
jest.mock('components/cube/MobileSubNav', () => () => <div />);
jest.mock('components/cube/CubeBottomNav', () => () => <div />);

const view = (name: string) => ({
  name,
  boards: ['mainboard'],
  displayView: 'table' as const,
  defaultSorts: ['Color Category', 'Types-Multicolor', 'Mana Value', 'Alphabetical'],
});

const cube = {
  id: 'c1',
  shortId: 'c1',
  name: 'Test Cube',
  views: [view('Mainboard'), view('Base Packs')],
} as unknown as Cube;

const Probe: React.FC = () => {
  const { activeView } = useContext(DisplayContext);
  return <span data-testid="active-view">{activeView}</span>;
};

const renderLayout = (activeLink: string, search: string) => {
  window.history.replaceState({}, '', `/cube/${activeLink}/c1${search}`);
  return render(
    <CSRFContext.Provider value={{ csrfFetch: jest.fn(), callApi: jest.fn() } as any}>
      <CubeLayout cube={cube} activeLink={activeLink}>
        <Probe />
      </CubeLayout>
    </CSRFContext.Provider>,
  );
};

const viewParam = () => new URLSearchParams(window.location.search).get('view');

describe('CubeLayout view param ownership', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resolves a cube view from the param on the list page', () => {
    renderLayout('list', '?view=base-packs');
    expect(screen.getByTestId('active-view')).toHaveTextContent('base-packs');
    expect(viewParam()).toBe('base-packs');
  });

  it('clears a param naming no cube view on the list page', () => {
    renderLayout('list', '?view=no-such-view');
    expect(viewParam()).toBeNull();
  });

  // Other cube sections drive their own navigation off the same `view` param
  // (?view=averages on analysis, ?view=blog on about). The list page's view
  // handling must not treat those as broken cube views and strip them.
  it.each([
    ['averages', '?view=averages'],
    ['blog', '?view=blog'],
    ['collaborators', '?view=collaborators'],
  ])('leaves the %s section param alone off the list page', (_section, search) => {
    renderLayout('analysis', search);
    expect(viewParam()).toBe(search.replace('?view=', ''));
  });
});
