import React from 'react';

import { CheckIcon } from '@primer/octicons-react';
import { DEFAULT_HERO_THEME, HERO_THEMES, HeroThemeKey, normalizeHeroTheme } from '@utils/heroTheme';
import classNames from 'classnames';

import { Flexbox } from '../base/Layout';
import Text from '../base/Text';

export interface HeroThemePickerProps {
  value?: string;
  /** Publishes the chosen key, or `''` for the default so the server clears the field. */
  setValue: (value: HeroThemeKey | '') => void;
}

const HeroThemePicker: React.FC<HeroThemePickerProps> = ({ value, setValue }) => {
  // Unset, the default, and anything unrecognised are all the same state: Green.
  const selected = normalizeHeroTheme(value) ?? DEFAULT_HERO_THEME;

  return (
    <Flexbox direction="col" gap="2">
      <Text sm className="text-text-secondary">
        The colour scheme for this cube&apos;s hero banner.
      </Text>
      <div className="flex flex-row flex-wrap gap-1" role="radiogroup" aria-label="Hero theme">
        {HERO_THEMES.map(({ key, label }) => {
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
                `hero-theme-${key}`,
                'w-7 h-7 rounded border-2 flex items-center justify-center bg-hero-bg text-hero-text',
                isSelected ? 'border-text ring-2 ring-focus-ring' : 'border-hero-badge-bg',
              )}
              onClick={() => setValue(key === DEFAULT_HERO_THEME ? '' : key)}
            >
              {isSelected ? <CheckIcon size={14} /> : <span aria-hidden="true">A</span>}
            </button>
          );
        })}
      </div>
    </Flexbox>
  );
};

export default HeroThemePicker;
