import { detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';

import {
  getCardHoarderLink,
  getCardKingdomLink,
  getCardMarketLink,
  getManaPoolLink,
  getTCGLink,
} from 'utils/Affiliate';

export interface PurchaseOption {
  /** Unique per row, since TCGPlayer contributes three. */
  id: string;
  label: string;
  href: string;
  /** The analytics vendor key. Every TCGPlayer finish reports as the one vendor. */
  vendor: string;
  price?: number;
  /** The price as shown, in the vendor's own currency. */
  display?: string;
}

const dollars = (price: number) => `$${price.toFixed(2)}`;
const euros = (price: number) => `€${price.toFixed(2)}`;
const tix = (price: number) => `${price.toFixed(2)} TIX`;

interface OptionSpec extends Omit<PurchaseOption, 'display'> {
  format: (price: number) => string;
  /** A finish the card was never printed in is dropped rather than listed empty. */
  onlyWithPrice?: boolean;
}

/**
 * The single description of where a card can be bought, shared by the card page's
 * Purchase table and the per-vendor buttons in the card modal, so links, prices and
 * analytics keys cannot drift apart.
 *
 * A vendor with no known price is still listed, since the storefront link is useful on
 * its own.
 */
export const purchaseOptions = (card: CardDetails): PurchaseOption[] => {
  const asCard = detailsToCard(card);
  const tcgHref = getTCGLink(asCard);

  const specs: OptionSpec[] = [
    {
      id: 'tcgplayer',
      vendor: 'tcgplayer',
      label: 'TCGPlayer',
      href: tcgHref,
      price: card.prices.usd,
      format: dollars,
    },
    {
      id: 'tcgplayer-foil',
      vendor: 'tcgplayer',
      label: 'TCGPlayer (Foil)',
      href: tcgHref,
      price: card.prices.usd_foil,
      format: dollars,
      onlyWithPrice: true,
    },
    {
      id: 'tcgplayer-etched',
      vendor: 'tcgplayer',
      label: 'TCGPlayer (Etched)',
      href: tcgHref,
      price: card.prices.usd_etched,
      format: dollars,
      onlyWithPrice: true,
    },
    {
      id: 'cardkingdom',
      vendor: 'cardkingdom',
      label: 'Card Kingdom',
      href: getCardKingdomLink(asCard),
      price: card.prices.ck,
      format: dollars,
    },
    {
      id: 'manapool',
      vendor: 'manapool',
      label: 'Mana Pool',
      href: getManaPoolLink(asCard),
      price: card.prices.mp,
      format: dollars,
    },
    {
      id: 'cardmarket',
      vendor: 'cardmarket',
      label: 'Cardmarket',
      href: getCardMarketLink(asCard),
      price: card.prices.eur,
      format: euros,
    },
    {
      id: 'cardhoarder',
      vendor: 'cardhoarder',
      label: 'Cardhoarder',
      href: getCardHoarderLink(asCard),
      price: card.prices.tix,
      format: tix,
    },
  ];

  return specs
    .filter((spec) => !spec.onlyWithPrice || !!spec.price)
    .map(({ format, onlyWithPrice: _onlyWithPrice, ...option }) => ({
      ...option,
      display: option.price ? format(option.price) : undefined,
    }));
};
