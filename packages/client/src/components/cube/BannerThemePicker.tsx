import React from 'react';

import { CheckIcon } from '@primer/octicons-react';
import { DEFAULT_BANNER_THEME, BANNER_THEMES, BannerThemeKey, normalizeBannerTheme } from '@utils/bannerTheme';
import classNames from 'classnames';

import { Flexbox } from '../base/Layout';
import Text from '../base/Text';

export interface BannerThemePickerProps {
  value?: string;
  /** Publishes the chosen key, or `''` for the default so the server clears the field. */
  setValue: (value: BannerThemeKey | '') => void;
}

const BannerThemePicker: React.FC<BannerThemePickerProps> = ({ value, setValue }) => {
  // Unset, the default, and anything unrecognised are all the same state: Green.
  const selected = normalizeBannerTheme(value) ?? DEFAULT_BANNER_THEME;

  return (
    <Flexbox direction="col" gap="2">
      <Text sm className="text-text-secondary">
        The color scheme for this cube&apos;s banner
      </Text>
      <div className="flex flex-row flex-wrap gap-2" role="radiogroup" aria-label="Banner color">
        {BANNER_THEMES.map(({ key, label }) => {
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={label}
              title={label}
              // Each swatch wears its own theme, so the fill, the glyph and the border are
              // the real colours rather than a separate preview that could drift from them.
              className={classNames(
                `banner-theme-${key}`,
                'w-14 h-14 rounded-md border-2 border-hero-badge-bg flex items-center justify-center bg-hero-bg text-hero-text cursor-pointer',
                // Selection is the ring and the check glyph; the accent border stays on every
                // swatch so the selected one still previews all three of its colours.
                isSelected && 'ring-2 ring-focus-ring',
              )}
              onClick={() => setValue(key === DEFAULT_BANNER_THEME ? '' : key)}
            >
              {isSelected ? (
                <CheckIcon size={24} />
              ) : (
                <span aria-hidden="true" className="text-xl font-semibold">
                  A
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Flexbox>
  );
};

export default BannerThemePicker;
