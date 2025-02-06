import React from 'react';

import CardHoarderButton from 'components/purchase/CardHoarderButton';
import CardKingdomButton from 'components/purchase/CardKingdomButton';
import CardMarketButton from 'components/purchase/CardMarketButton';
import ManaPoolButton from 'components/purchase/ManaPoolButton';
import TCGPlayerButton from 'components/purchase/TCGPlayerButton';

import { CardDetails } from '../../../datatypes/Card';
import { Card, CardBody, CardHeader } from '../base/Card';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';

interface PurchaseProps {
  card: CardDetails;
}

const Purchase: React.FC<PurchaseProps> = ({ card }) => {
  return (
    <Card>
      <CardHeader>
        <Text semibold lg>
          Purchase
        </Text>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="2">
          <TCGPlayerButton card={card} />
          <CardKingdomButton card={card} />
          <ManaPoolButton card={card} />
          <CardMarketButton card={card} />
          <CardHoarderButton card={card} />
        </Flexbox>
      </CardBody>
    </Card>
  );
};

export default Purchase;
