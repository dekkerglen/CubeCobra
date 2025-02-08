import {
  getBulkManaPoolLink,
  getCardHoarderLink,
  getCardKingdomLink,
  getCardMarketLink,
  getManaPoolLink,
  getTCGLink,
  tcgplayerAffiliate,
} from 'utils/Affiliate';

import { createCard, createCardDetails } from '../test-utils/data';

describe('TCGPlayer', () => {
  it('should generate a valid link for a card with a TCGPlayer ID', () => {
    const card = createCard({ details: createCardDetails({ tcgplayer_id: 'tcg-card-id' }) });
    const uri = 'https://shop.tcgplayer.com/product/productsearch?id=tcg-card-id';

    expect(getTCGLink(card)).toEqual(`${tcgplayerAffiliate}?u=${encodeURI(uri)}`);
  });

  it('should generate a valid link for a card without a TCGPlayer ID', () => {
    const card = createCard({ details: createCardDetails({ name: 'Lightning Bolt' }) });
    const uri = `https://shop.tcgplayer.com/productcatalog/product/show?ProductName=Lightning Bolt`;

    expect(getTCGLink(card)).toEqual(`${tcgplayerAffiliate}?u=${encodeURI(uri)}`);
  });

  it('should generate a valid link for a token', () => {
    const token = createCard({ details: createCardDetails({ name: 'Human Soldier', isToken: true }) });
    const uri = `https://shop.tcgplayer.com/productcatalog/product/show?ProductName=Human Soldier Token`;

    expect(getTCGLink(token)).toEqual(`${tcgplayerAffiliate}?u=${encodeURI(uri)}`);
  });
});

describe('CardMarket', () => {
  it('should generate a valid link for a card with a TCGPlayer ID', () => {
    const card = createCard({ details: createCardDetails({ name: 'Birds of Paradise', set_name: 'Seventh Edition' }) });

    expect(getCardMarketLink(card)).toEqual(
      'https://www.cardmarket.com/en/Magic/Products/Singles/Seventh-Edition/Birds-of-Paradise',
    );
  });
});

describe('ManaPool', () => {
  it('should generate a valid link for a card with a Mana Pool', () => {
    const card = createCard({
      details: createCardDetails({ name: 'Birds of Paradise', set: '6ED', collector_number: '217' }),
    });

    expect(getManaPoolLink(card)).toEqual('https://manapool.com/card/6ed/217/birds-of-paradise?ref=cubecobra');
  });

  it('should generate a valid link for a card with a Mana Pool, for a promo collector', () => {
    const card = createCard({
      details: createCardDetails({ name: 'Birds of Paradise', set: '7ed', collector_number: '231★' }),
    });

    expect(getManaPoolLink(card)).toEqual('https://manapool.com/card/7ed/231★/birds-of-paradise?ref=cubecobra');
  });

  it('should generate a valid link for a deck with a Mana Pool', () => {
    const cards = [
      createCard({
        details: createCardDetails({ name: 'Birds of Paradise', set: '7ed', collector_number: '231★' }),
      }),
      createCard({
        details: createCardDetails({ name: 'Oko, Thief of Crowns', set: 'ELD', collector_number: '197' }),
      }),
    ];

    let cardDetails = '';
    cardDetails += `Birds of Paradise [7ed] 231★\n`;
    cardDetails += `Oko, Thief of Crowns [ELD] 197`;

    const encodedDeck = btoa(unescape(encodeURIComponent(cardDetails)));

    expect(getBulkManaPoolLink(cards)).toEqual(`https://manapool.com/add-deck?ref=cubecobra&deck=${encodedDeck}`);
  });
});

describe('Card Hoarder', () => {
  it('should generate a valid link for a card with a Card Hoarder', () => {
    const card = createCard({
      details: createCardDetails({ name: 'Oko, Thief of Crowns', set: 'ELD', collector_number: '197' }),
    });

    const encodedCardName = 'Oko%2C%20Thief%20of%20Crowns';

    expect(getCardHoarderLink(card)).toEqual(
      `https://www.cardhoarder.com/cards?data%5Bsearch%5D=${encodedCardName}?affiliate_id=cubecobra&utm_source=cubecobra&utm_campaign=affiliate&utm_medium=card`,
    );
  });
});

describe('Card Kingdom', () => {
  it('should generate a valid link for a card with a Card Kingdom', () => {
    const card = createCard({
      details: createCardDetails({
        name: 'Oko, Thief of Crowns',
        set_name: 'Throne of Eldraine',
        collector_number: '197',
      }),
    });

    const encodedSetName = 'throne-of-eldraine';
    const encodedCardName = 'oko-thief-of-crowns';

    expect(getCardKingdomLink(card)).toEqual(
      `https://www.cardkingdom.com/mtg/${encodedSetName}/${encodedCardName}?partner=CubeCobra&utm_source=CubeCobra&utm_medium=affiliate&utm_campaign=CubeCobra`,
    );
  });
});
