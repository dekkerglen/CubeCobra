export function getTCGLink(card, isToken) {
  let tcgplayerLink = 'https://shop.tcgplayer.com/';
  if (card.details.tcgplayer_id) {
    tcgplayerLink += `product/productsearch?id=${card.details.tcgplayer_id}`;
  } else {
    tcgplayerLink += `productcatalog/product/show?ProductName=${card.details.name}`;
    if (isToken) {
      tcgplayerLink += ' Token';
    }
  }
  tcgplayerLink += '&partner=CubeCobra&utm_campaign=affiliate&utm_medium=CubeCobra&utm_source=CubeCobra';
  
  return tcgplayerLink;
}
export default { getTCGLink }