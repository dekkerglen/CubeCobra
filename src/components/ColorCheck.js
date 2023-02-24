import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

import { Button, ButtonGroup } from 'reactstrap';

import { COLORS } from 'utils/Util';

export const ColorCheckButton = ({ size, color, short, checked, onClick }) => {
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

ColorCheckButton.propTypes = {
  size: PropTypes.string,
  color: PropTypes.string.isRequired,
  short: PropTypes.string.isRequired,
  checked: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

ColorCheckButton.defaultProps = {
  size: 'sm',
};

export const ColorChecksControl = ({ colorless, prefix, size, values, setValues, style }) => {
  const smallStyle = {
    height: 'calc(1.5em + .5rem + 2px)',
    fontSize: '0.875rem',
  };

  return (
    <ButtonGroup size={size} style={size === 'sm' ? smallStyle : style}>
      {COLORS.map(([color, short]) => (
        <ColorCheckButton
          key={short}
          prefix={prefix}
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
          prefix={prefix}
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

ColorChecksControl.propTypes = {
  colorless: PropTypes.bool,
  prefix: PropTypes.string,
  size: PropTypes.string,
  values: PropTypes.arrayOf(PropTypes.string),
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
          key={short}
          prefix={prefix}
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

ColorChecksAddon.propTypes = {
  colorless: PropTypes.bool,
  prefix: PropTypes.string,
  size: PropTypes.string,
  values: PropTypes.arrayOf(PropTypes.string),
  setValues: PropTypes.func.isRequired,
};

ColorChecksAddon.defaultProps = {
  colorless: false,
  prefix: 'color',
  size: 'sm',
  values: [],
};
