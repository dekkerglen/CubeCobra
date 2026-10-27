import React from 'react';

import { CardDetails } from '@utils/datatypes/Card';

import { trackEvent } from 'utils/analytics';

import Link from '../base/Link';
import Table from '../base/Table';
import { purchaseOptions } from './vendors';

interface PurchaseTableProps {
  card: CardDetails;
}

/**
 * Where to buy a card, as a striped table of vendor links. Shared by the card page's
 * Purchase section and the cube page's card modal so both read the same way.
 */
const PurchaseTable: React.FC<PurchaseTableProps> = ({ card }) => (
  <Table
    borderless
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
);

export default PurchaseTable;
