import React from 'react';

import { Button, Form, Input } from 'reactstrap';

import { tcgMassEntryUrl } from '../utils/Affiliate';

const getEntry = ({ details }) => (details.isToken ? `1 ${details.name} Token` : `1 ${details.name}`);

const MassBuyButton = ({ cards, children, ...props }) => (
  <Form method="POST" action={tcgMassEntryUrl} inline>
    <Input type="hidden" name="c" value={cards.map(getEntry).join('||')} />
    <Button type="submit" color="secondary" {...props}>
      {children}
    </Button>
  </Form>
);

export default MassBuyButton;
