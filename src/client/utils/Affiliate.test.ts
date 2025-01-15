import { createCard, createCardDetails } from 'src/test-utils/data';

import { getCardMarketLink, getTCGLink, tcgplayerAffiliate } from 'utils/Affiliate';

describe('TCGPlayer', () => {
  it('should generate a valid link for a card with a TCGPlayer ID', () => {
    const card = createCard({ details: createCardDetails({ tcgplayer_id: 'tcg-card-id' }) });
    const uri = 'https://shop.tcgplayer.com/product/productsearch?id=tcg-card-id'

    expect(getTCGLink(card)).toEqual(`${tcgplayerAffiliate}?u=${encodeURI(uri)}`);
  });

  it('should generate a valid link for a card without a TCGPlayer ID', () => {
    const card = createCard({details: createCardDetails({ name: 'Lightning Bolt' }) });
    const uri = `https://shop.tcgplayer.com/productcatalog/product/show?ProductName=Lightning Bolt`

    expect(getTCGLink(card)).toEqual(`${tcgplayerAffiliate}?u=${encodeURI(uri)}`);
  })

  it('should generate a valid link for a token', () => {
    const token = createCard({details: createCardDetails({ name: 'Human Soldier', isToken: true }) });
    const uri = `https://shop.tcgplayer.com/productcatalog/product/show?ProductName=Human Soldier Token`

    expect(getTCGLink(token)).toEqual(`${tcgplayerAffiliate}?u=${encodeURI(uri)}`);
  });
});

describe('CardMarket', () => {
  it('should generate a valid link for a card with a TCGPlayer ID', () => {
    const card = createCard({details: createCardDetails({ name: 'Birds of Paradise', set_name: 'Seventh Edition' }) });

    expect(getCardMarketLink(card)).toEqual('https://www.cardmarket.com/en/Magic/Products/Singles/Seventh-Edition/Birds-of-Paradise');
  })
})