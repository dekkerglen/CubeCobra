import React, { useMemo } from 'react';
import { Button, ButtonGroup } from 'reactstrap';

import { COLORS } from 'utils/Util';

interface ColorCheckButtonProps {
  size?: string;
  color: string;
  short: string;
  checked: boolean;
  onClick: () => void;
}

export const ColorCheckButton: React.FC<ColorCheckButtonProps> = ({ size, color, short, checked, onClick }) => {
  const symbolClassName = size ? `mana-symbol-${size}` : 'mana-symbol';
  return (
    <Button
      className={`color-check-button${checked ? ' active' : ''}`}
      outline={!checked}
      size={size}
      onClick={onClick}
      aria-label={color}
    >
      <img src={`/content/symbols/${short.toLowerCase()}.png`} alt={color} title={color} className={symbolClassName} />
    </Button>
  );
};

interface ColorChecksControlProps {
  colorless?: boolean;
  size?: string;
  values: string[];
  setValues: (values: string[]) => void;
  style?: React.CSSProperties;
}

export const ColorChecksControl: React.FC<ColorChecksControlProps> = ({
  colorless,
  size,
  values,
  setValues,
  style,
}) => {
  const smallStyle: React.CSSProperties = {
    height: 'calc(1.5em + .5rem + 2px)',
    fontSize: '0.875rem',
  };

  return (
    <ButtonGroup size={size} style={size === 'sm' ? smallStyle : style}>
      {COLORS.map(([color, short]) => (
        <ColorCheckButton
          key={short}
          size={size}
          color={color}
          short={short}
          checked={values.includes(short)}
          onClick={() => {
            if (!values.includes(short)) {
              setValues([...new Set([...values, short])].filter((c) => c !== 'C'));
            } else {
              setValues(values.filter((c) => c !== short));
            }
          }}
        />
      ))}
      {colorless && (
        <ColorCheckButton
          size={size}
          color="Colorless"
          short="C"
          checked={values.includes('C')}
          onClick={() => {
            if (!values.includes('C')) {
              setValues(['C']);
            } else {
              setValues([]);
            }
          }}
        />
      )}
    </ButtonGroup>
  );
};

export interface ColorChecksAddonProps {
  colorless?: boolean;
  size?: string;
  values: string[];
  setValues: (values: string[]) => void;
}

export const ColorChecksAddon: React.FC<ColorChecksAddonProps> = ({ colorless, size, values, setValues }) => {
  const colors = useMemo(() => {
    const c = [...COLORS];
    if (colorless) {
      c.push(['Colorless', 'C']);
    }
    return c;
  }, [colorless]);

  return (
    <>
      {colors.map(([color, short]) => (
        <ColorCheckButton
          key={short}
          size={size}
          color={color}
          short={short}
          checked={values.includes(short)}
          onClick={() => {
            if (!values.includes(short)) {
              setValues([...new Set([...values, short])]);
            } else {
              setValues(values.filter((c) => c !== short));
            }
          }}
        />
      ))}
    </>
  );
};
