import React from 'react';

import { CardDetails } from '@utils/datatypes/Card';

import { purchaseOptions } from 'components/purchase/vendors';
import { trackEvent } from 'utils/analytics';

import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';

interface VendorButtonProps {
  card: CardDetails;
  /** Matches PurchaseOption.id, e.g. 'tcgplayer' or 'tcgplayer-foil'. */
  optionId: string;
}

/**
 * One vendor rendered as a button, for the card modal. The card page's Purchase section
 * renders the same options as table rows instead; both read from purchaseOptions so the
 * link, price and analytics key stay in step.
 */
const VendorButton: React.FC<VendorButtonProps> = ({ card, optionId }) => {
  const option = purchaseOptions(card).find((candidate) => candidate.id === optionId);

  if (!option) {
    return null;
  }

  return (
    <Button
      type="link"
      outline
      color="accent"
      block
      href={option.href}
      target="_blank"
      onClick={() =>
        trackEvent('affiliate_click', { vendor: option.vendor, scope: 'single', cards_value: option.price ?? 0 })
      }
    >
      <Flexbox direction="row" justify="between" className="w-full">
        <Text semibold>{option.label}</Text>
        {option.display && <Text semibold>{option.display}</Text>}
      </Flexbox>
    </Button>
  );
};

export default VendorButton;
