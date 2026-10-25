import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import { CSRFContext } from 'contexts/CSRFContext';
import CubeLayout from 'layouts/CubeLayout';

jest.mock('components/Banner', () => () => <div />);
jest.mock('components/cube/CubeHero', () => () => <div data-testid="cube-hero" />);
jest.mock('components/cube/CubeSidebar', () => () => <div />);
jest.mock('components/cube/MobileSubNav', () => () => <div data-testid="mobile-sub-nav" />);
jest.mock('components/cube/CubeBottomNav', () => () => <div />);

const buildCube = (heroTheme?: string) =>
  ({
    id: 'c1',
    shortId: 'c1',
    name: 'Test Cube',
    views: [],
    heroTheme,
  }) as unknown as Cube;

// The theme class goes on the element containing both the hero and the mobile sub-nav, so
// the strip under the banner inherits the custom properties through the cascade.
const renderLayout = (heroTheme?: string) => {
  window.history.replaceState({}, '', '/cube/list/c1');
  render(
    <CSRFContext.Provider value={{ csrfFetch: jest.fn(), callApi: jest.fn() } as any}>
      <CubeLayout cube={buildCube(heroTheme)} activeLink="list" />
    </CSRFContext.Provider>,
  );

  const hero = screen.getByTestId('cube-hero');
  const wrapper = hero.parentElement as HTMLElement;
  return wrapper;
};

describe('CubeLayout hero theme', () => {
  it('adds no theme class when the cube has none', () => {
    expect(renderLayout().className).not.toContain('hero-theme-');
  });

  it('adds no theme class for the default green', () => {
    expect(renderLayout('green').className).not.toContain('hero-theme-');
  });

  it('adds the theme class for a non-default theme', () => {
    expect(renderLayout('blue')).toHaveClass('hero-theme-blue');
  });

  it('ignores an unknown stored theme', () => {
    expect(renderLayout('purple').className).not.toContain('hero-theme-');
  });

  it('keeps the hero and sub-nav under the themed wrapper', () => {
    const wrapper = renderLayout('blue');
    expect(wrapper).toContainElement(screen.getByTestId('cube-hero'));
    expect(wrapper).toContainElement(screen.getByTestId('mobile-sub-nav'));
  });
});
