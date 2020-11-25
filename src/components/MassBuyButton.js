import React from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import { Button, Form, Input } from 'reactstrap';

import { tcgMassEntryUrl } from 'utils/Affiliate';

const exclude = ['Copy'];

const specialCases = {
  "City's Blessing": "City's Blessing Token (006)",
  'Energy Reserve': 'Energy Reserve Token',
  'Poison Counter': 'Poison Counter Token',
  'The Monarch': 'The Monarch Token',
  'Wrenn and Six Emblem': 'Goblin (010) // Emblem - Wrenn and Six (021) Double-sided Token',
  'Serra the Benevolent Emblem': 'Goblin (010) // Emblem - Serra the Benevolent (020) Double-sided Token',
};

const getEntry = ({ details }) => {
  if (exclude.includes(details.name)) {
    return null;
  }
  if (specialCases[details.name]) {
    return `1 ${specialCases[details.name]}`;
  }
  if (details.isToken) {
    return `1 ${details.name} Token`;
  }
  if (details.name.endsWith('Emblem')) {
    return `1 Emblem - ${details.name.replace(' Emblem', '')}`;
  }
  return `1 ${details.name}`;
};

const MassBuyButton = ({ cards, ...props }) => (
  <Form method="POST" action={tcgMassEntryUrl} inline>
    <Input
      type="hidden"
      name="c"
      value={cards
        .map(getEntry)
        .filter((x) => x)
        .join('||')}
    />
    <Button type="submit" color="secondary" {...props} />
  </Form>
);

MassBuyButton.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
};

export default MassBuyButton;
