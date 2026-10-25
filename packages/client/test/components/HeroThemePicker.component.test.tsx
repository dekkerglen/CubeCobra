import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { HERO_THEMES } from '@utils/heroTheme';

import HeroThemePicker from 'components/cube/HeroThemePicker';

const setValue = jest.fn();

describe('HeroThemePicker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a swatch for every registered theme', () => {
    render(<HeroThemePicker value="" setValue={setValue} />);
    expect(screen.getAllByRole('radio')).toHaveLength(HERO_THEMES.length);
  });

  it('names each swatch without a visible label', () => {
    render(<HeroThemePicker value="" setValue={setValue} />);
    expect(screen.getByRole('radio', { name: 'Blue' })).toBeInTheDocument();
    expect(screen.queryByText('Blue')).not.toBeInTheDocument();
  });

  it('marks green selected when nothing is stored', () => {
    render(<HeroThemePicker value="" setValue={setValue} />);
    expect(screen.getByRole('radio', { name: 'Green' })).toBeChecked();
  });

  it('marks green selected when the stored theme is unrecognised', () => {
    render(<HeroThemePicker value="purple" setValue={setValue} />);
    expect(screen.getByRole('radio', { name: 'Green' })).toBeChecked();
  });

  it('publishes a non-default choice', () => {
    render(<HeroThemePicker value="" setValue={setValue} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blue' }));
    expect(setValue).toHaveBeenCalledWith('blue');
  });

  it('publishes an empty value when green is chosen', () => {
    render(<HeroThemePicker value="blue" setValue={setValue} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Green' }));
    expect(setValue).toHaveBeenCalledWith('');
  });

  it('previews each theme with its own colours', () => {
    render(<HeroThemePicker value="" setValue={setValue} />);
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveClass('hero-theme-blue');
  });
});
