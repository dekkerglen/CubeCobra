import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

import { Button, ButtonGroup } from 'reactstrap';

import { COLORS } from 'utils/Util';

export const ColorCheckButton = ({ size, color, short, checked, setChecked }) => {
  const symbolClassName = size ? `mana-symbol-${size}` : 'mana-symbol';
  return (
    <Button
      className={`color-check-button${checked ? ' active' : ''}`}
      outline={!checked}
      size={size}
      onClick={() => setChecked(!checked)}
      aria-label={color}
    >
      <img src={`/content/symbols/${short.toLowerCase()}.png`} alt={color} title={color} className={symbolClassName} />
    </Button>
  );
};

ColorCheckButton.propTypes = {
  size: PropTypes.string,
  color: PropTypes.string.isRequired,
  short: PropTypes.string.isRequired,
  checked: PropTypes.bool,
  setChecked: PropTypes.func.isRequired,
};

ColorCheckButton.defaultProps = {
  size: 'sm',
  checked: false,
};

export const ColorChecksControl = ({ colorless, prefix, size, values, setValues, style }) => {
  const colors = colorless ? [...COLORS, ['Colorless', 'C']] : COLORS;

  const smallStyle = {
    height: 'calc(1.5em + .5rem + 2px)',
    fontSize: '0.875rem',
  };

  return (
    <ButtonGroup size={size} style={size === 'sm' ? smallStyle : style}>
      {colors.map(([color, short]) => (
        <ColorCheckButton
          key={short}
          prefix={prefix}
          size={size}
          color={color}
          short={short}
          checked={values.map((tuple) => tuple[1]).includes(color)}
          onChange={(event) => {
            if (event.target.checked) {
              setValues([...values, short]);
            } else {
              setValues(values.filter((tuple) => tuple[1] !== short));
            }
          }}
        />
      ))}
    </ButtonGroup>
  );
};

ColorChecksControl.propTypes = {
  colorless: PropTypes.bool,
  prefix: PropTypes.string,
  size: PropTypes.string,
  values: PropTypes.shape([]),
  setValues: PropTypes.func.isRequired,
  style: PropTypes.shape({}),
};

ColorChecksControl.defaultProps = {
  colorless: false,
  prefix: 'color',
  size: 'sm',
  values: {},
  style: {},
};

export const ColorChecksAddon = ({ colorless, prefix, size, values, setValues }) => {
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
          prefix={prefix}
          size={size}
          color={color}
          short={short}
          checked={values.includes(short)}
          setChecked={(checked) => {
            if (checked) {
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

ColorChecksAddon.propTypes = {
  colorless: PropTypes.bool,
  prefix: PropTypes.string,
  size: PropTypes.string,
  values: PropTypes.arrayOf(PropTypes.string).isRequired,
  setValues: PropTypes.func.isRequired,
};

ColorChecksAddon.defaultProps = {
  colorless: false,
  prefix: 'color',
  size: 'sm',
};
