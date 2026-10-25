import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { BANNER_THEMES } from '@utils/bannerTheme';

import BannerThemePicker from 'components/cube/BannerThemePicker';

const setValue = jest.fn();

describe('BannerThemePicker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a swatch for every registered theme', () => {
    render(<BannerThemePicker value="" setValue={setValue} />);
    expect(screen.getAllByRole('radio')).toHaveLength(BANNER_THEMES.length);
  });

  it('names each swatch without a visible label', () => {
    render(<BannerThemePicker value="" setValue={setValue} />);
    expect(screen.getByRole('radio', { name: 'Blue' })).toBeInTheDocument();
    expect(screen.queryByText('Blue')).not.toBeInTheDocument();
  });

  it('marks green selected when nothing is stored', () => {
    render(<BannerThemePicker value="" setValue={setValue} />);
    expect(screen.getByRole('radio', { name: 'Green' })).toBeChecked();
  });

  it('marks green selected when the stored theme is unrecognised', () => {
    render(<BannerThemePicker value="purple" setValue={setValue} />);
    expect(screen.getByRole('radio', { name: 'Green' })).toBeChecked();
  });

  it('publishes a non-default choice', () => {
    render(<BannerThemePicker value="" setValue={setValue} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blue' }));
    expect(setValue).toHaveBeenCalledWith('blue');
  });

  it('publishes an empty value when green is chosen', () => {
    render(<BannerThemePicker value="blue" setValue={setValue} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Green' }));
    expect(setValue).toHaveBeenCalledWith('');
  });

  it('previews each theme with its own colours', () => {
    render(<BannerThemePicker value="" setValue={setValue} />);
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveClass('banner-theme-blue');
  });

  // The selected swatch is the one the owner is looking at, so it must keep showing its
  // accent colour; the ring and check already carry the selected state.
  it('keeps the accent border on the selected swatch', () => {
    render(<BannerThemePicker value="blue" setValue={setValue} />);
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveClass('border-hero-badge-bg');
  });
});
