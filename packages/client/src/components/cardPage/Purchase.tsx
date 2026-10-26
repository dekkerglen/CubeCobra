import React from 'react';

import { CardDetails } from '@utils/datatypes/Card';

import { purchaseOptions } from 'components/purchase/vendors';
import { trackEvent } from 'utils/analytics';

import { Card, CardHeader } from '../base/Card';
import Link from '../base/Link';
import Table from '../base/Table';
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
    <Table
      headers={['Vendor', 'Price']}
      rows={purchaseOptions(card).map((option) => ({
        Vendor: (
          <Link
            href={option.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent('affiliate_click', {
                vendor: option.vendor,
                scope: 'single',
                cards_value: option.price ?? 0,
              })
            }
          >
            {option.label}
          </Link>
        ),
        Price: option.display ?? '',
      }))}
    />
  </Card>
);

export default Purchase;
