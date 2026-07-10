import React, { useMemo, useState } from 'react';

import { CheckIcon } from '@primer/octicons-react';
import { getContrastingTextColor, isTagHexColor } from '@utils/Util';
import classNames from 'classnames';
import { HexColorInput, HexColorPicker } from 'react-colorful';

import { TAG_COLORS } from '../contexts/CubeContext';
import Collapse from './base/Collapse';
import { Flexbox } from './base/Layout';
import Text from './base/Text';

// Background hex for each built-in named tag color. Mirrors css/tags.css so the preset
// swatches (and the picker seed color) preview accurately.
export const NAMED_TAG_COLOR_HEX: Record<string, string> = {
  red: '#8e1600',
  brown: '#654321',
  orange: '#ff7034',
  yellow: '#e0b83d',
  green: '#2cb52c',
  turquoise: '#00adaf',
  blue: '#0e4d8b',
  purple: '#633295',
  violet: '#da6fff',
  pink: '#ff69b4',
};

const DEFAULT_PICKER_COLOR = '#8e1600';

// The named presets (everything in TAG_COLORS except the "None" entry).
const PRESETS = TAG_COLORS.filter(([, value]) => value !== 'no-color');

const swatchStyle = (background: string): React.CSSProperties => ({
  backgroundColor: background,
  color: getContrastingTextColor(background),
});

interface TagColorPickerProps {
  // Current color: a named preset value (e.g. "red"), a hex string, or "no-color"/null.
  value: string | null;
  onChange: (color: string) => void;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  // Rendered inline to the left of the swatch trigger (e.g. a drag handle and the tag preview).
  children?: React.ReactNode;
}

const TagColorPicker: React.FC<TagColorPickerProps> = ({ value, onChange, onPointerDown, children }) => {
  const [open, setOpen] = useState(false);

  const isHex = isTagHexColor(value);
  const isNamed = !!value && value !== 'no-color' && !isHex;

  // What the trigger swatch should preview and what the hex picker should be seeded with.
  const displayHex = isHex ? value : isNamed ? NAMED_TAG_COLOR_HEX[value] : null;
  const pickerColor = displayHex ?? DEFAULT_PICKER_COLOR;

  const label = useMemo(() => {
    if (isHex) return value;
    if (isNamed) {
      const preset = TAG_COLORS.find(([, v]) => v === value);
      return preset ? preset[0] : value;
    }
    return 'None';
  }, [isHex, isNamed, value]);

  return (
    <Flexbox direction="col" gap="2">
      <Flexbox direction="row" justify="between" alignItems="center" gap="2">
        {children}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          onPointerDown={onPointerDown}
          className="flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-bg text-sm shrink-0"
        >
          <span
            className="inline-block w-5 h-5 rounded border border-border"
            style={displayHex ? { backgroundColor: displayHex } : undefined}
          />
          <span className="truncate max-w-24">{label}</span>
        </button>
      </Flexbox>
      <div onPointerDown={onPointerDown}>
        <Collapse isOpen={open}>
          <Flexbox direction="col" gap="2" className="p-2 border border-border rounded-md bg-bg">
            <Text sm semibold>
              Presets
            </Text>
            <Flexbox direction="row" gap="1" wrap="wrap">
              <button
                type="button"
                onClick={() => onChange('no-color')}
                className={classNames(
                  'w-7 h-7 rounded border flex items-center justify-center bg-bg-active text-xs',
                  value === 'no-color' || !value ? 'border-text ring-2 ring-focus-ring' : 'border-border',
                )}
                title="None"
              >
                {(value === 'no-color' || !value) && <CheckIcon size={14} />}
              </button>
              {PRESETS.map(([name, presetValue]) => {
                const background = NAMED_TAG_COLOR_HEX[presetValue];
                const selected = value === presetValue;
                return (
                  <button
                    key={presetValue}
                    type="button"
                    onClick={() => onChange(presetValue)}
                    className={classNames(
                      'w-7 h-7 rounded border flex items-center justify-center',
                      selected ? 'border-text ring-2 ring-focus-ring' : 'border-border',
                    )}
                    style={swatchStyle(background)}
                    title={name}
                  >
                    {selected && <CheckIcon size={14} />}
                  </button>
                );
              })}
            </Flexbox>
            <Text sm semibold>
              Custom
            </Text>
            <HexColorPicker color={pickerColor} onChange={onChange} />
            <Flexbox direction="row" gap="1" alignItems="center">
              <span className="text-sm">#</span>
              <HexColorInput
                color={pickerColor}
                onChange={onChange}
                prefixed={false}
                className="block w-full px-3 py-2 border border-border bg-bg rounded-md text-sm uppercase"
              />
            </Flexbox>
          </Flexbox>
        </Collapse>
      </div>
    </Flexbox>
  );
};

export default TagColorPicker;
