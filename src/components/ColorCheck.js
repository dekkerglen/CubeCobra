import React, { Fragment, useCallback } from 'react';

import { Button, FormGroup, Input, InputGroupAddon, Label } from 'reactstrap';

import { COLORS } from '../util/Util';

export const ColorChecks = ({ prefix, values, onChange }) =>
  COLORS.map(([color, short]) => (
    <FormGroup key={short} check inline>
      <Label check>
        <ColorCheck
          key={short}
          prefix={prefix}
          color={color}
          short={short}
          value={values[`${prefix || 'color'}${short}`]}
          onChange={onChange}
        />
        <img src={`/content/symbols/${short.toLowerCase()}.png`} alt={color} title={color} />
      </Label>
    </FormGroup>
  ));

export const ColorCheckButton = ({ prefix, color, short, value, onChange }) => {
  const handleClick = useCallback((event) => {
    event.preventDefault();
    const name = prefix + short;
    onChange({
      target: { name, value: !value },
    });
    if (short === 'C' && !value) {
      for (const other of [...'WUBRG']) {
        onChange({
          target: {
            name: prefix + other,
            value: false,
          }
        });
      }
    } else if ([...'WUBRG'].includes(short) && !value) {
      onChange({
        target: {
          name: prefix + 'C',
          value: false,
        }
      });
    }
  }, [prefix, color, short, value, onChange]);
  return (
    <Button
      className={'color-check-button' + (value ? ' active' : '')}
      outline={!value}
      onClick={handleClick}
      aria-label={color}
    >
      <img src={`/content/symbols/${short.toLowerCase()}.png`} alt={color} title={color} />
    </Button>
  );
};

export const ColorChecksAddon = ({ addonType, colorless, prefix, values, onChange }) => {
  const colors = [...COLORS];
  if (colorless) {
    colors.push(['Colorless', 'C']);
  }
  return (
    <Fragment>
      {colors.map(([color, short]) =>
        <InputGroupAddon key={short} addonType={addonType}>
          <ColorCheckButton
            prefix={prefix}
            color={color}
            short={short}
            value={values[prefix + short]}
            onChange={onChange}
          />
        </InputGroupAddon>
      )}
    </Fragment>
  );
}

ColorChecksAddon.defaultProps = {
  addonType: 'prepend',
  colorless: false,
  prefix: 'color',
};

const ColorCheck = ({ prefix, color, short, value, onChange }) => (
  <Input
    type="checkbox"
    name={`${prefix || 'color'}${short.toUpperCase()}`}
    checked={value}
    onChange={onChange}
  />
);

export default ColorCheck;
