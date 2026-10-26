import React from 'react';

import { CardDetails } from '@utils/datatypes/Card';

import PurchaseTable from 'components/purchase/PurchaseTable';

import { Card, CardHeader } from '../base/Card';
import Text from '../base/Text';

interface PurchaseProps {
  card: CardDetails;
}

const Purchase: React.FC<PurchaseProps> = ({ card }) => (
  <Card>
    <CardHeader>
      <Text semibold lg>
        Purchase
      </Text>
    </CardHeader>
    <PurchaseTable card={card} />
  </Card>
);

export default Purchase;
