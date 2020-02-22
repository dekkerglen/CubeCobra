const fetch = require('node-fetch');
const url = require('url');
const winston = require('winston');
const tcgconfig = require('../../cubecobrasecrets/tcgplayer');

var token = null;
const cached_prices = {};

async function GetToken() {
  if (token && Date.now() < token.expires) {
    //TODO: check if token is expired, if so, fetch a new one
    return token.access_token;
  } else {
    winston.info('Fetching fresh TCGPlayer token.');

    const body = new url.URLSearchParams({
      grant_type: 'client_credentials',
      client_id: tcgconfig.Public_Key,
      client_secret: tcgconfig.Private_Key,
    });
    const response = await fetch('https://api.tcgplayer.com/token', {
      method: 'POST',
      header: 'application/x-www-form-urlencoded',
      body: body.toString(),
    }).then(checkStatus);
    try {
      token = await response.json();
      token.expires = Tomorrow();
      winston.info(`${token.expires} token expiration`);
      return token.access_token;
    } catch (e) {
      return;
    }
  }
}

function Tomorrow() {
  var date = new Date();
  //add 1 day to expiration date
  date.setDate(date.getDate() + 1);
  return date;
}

function checkStatus(response) {
  if (response.ok) {
    return Promise.resolve(response);
  } else {
    return Promise.reject(new Error(response.statusText));
  }
}
async function GetPrices(card_ids) {
  var price_dict = {};

  if (!tcgconfig.Public_Key || !tcgconfig.Private_Key) {
    return price_dict;
  }

  //trim card_ids if we have a recent cached date
  for (i = card_ids.length - 1; i >= 0; i--) {
    if (cached_prices[card_ids[i]] && cached_prices[card_ids[i]].expires < Date.now()) {
      if (cached_prices[card_ids[i]].price) {
        price_dict[card_ids[i]] = cached_prices[card_ids[i]].price;
      }
      if (cached_prices[card_ids[i]].price_foil) {
        price_dict[card_ids[i] + '_foil'] = cached_prices[card_ids[i]].price_foil;
      }
      card_ids.splice(i, 1);
    }
  }

  if (card_ids.length == 0) {
    return price_dict;
  }

  const chunkSize = 250;
  //max tcgplayer request size is 250
  const chunks = [];
  for (i = 0; i < card_ids.length / chunkSize; i++) {
    chunks.push(card_ids.slice(i * chunkSize, (i + 1) * chunkSize));
  }

  let access_token;
  try {
    access_token = await GetToken();
    const responses = await Promise.all(
      chunks.map((chunk) =>
        fetch('http://api.tcgplayer.com/v1.32.0/pricing/product/' + chunk.join(','), {
          headers: {
            Authorization: 'Bearer ' + access_token,
          },
        })
          .then(checkStatus)
          .then((response) => response.json())
          .catch((err) => winston.error('TCGPlayer request failed.', { error: err })),
      ),
    );
    for (response of responses) {
      if (!response || !response.success) {
        continue;
      }
      for (item of response.results) {
        if (!cached_prices[item.productId]) {
          cached_prices[item.productId] = {};
        }
        if (item.marketPrice && item.subTypeName == 'Normal') {
          price_dict[item.productId] = item.marketPrice;
          cached_prices[item.productId].price = item.marketPrice;
          cached_prices[item.productId].expires = Tomorrow();
        } else if (item.marketPrice && item.subTypeName == 'Foil') {
          price_dict[item.productId + '_foil'] = item.marketPrice;
          cached_prices[item.productId].price_foil = item.marketPrice;
          cached_prices[item.productId].expires = Tomorrow();
        }
      }
    }
    return price_dict;
  } catch (err) {
    winston.error(err);
    return price_dict;
  }
}

async function addPrices(cards) {
  const tcgplayerIds = cards.map((card) => card.details.tcgplayer_id).filter((id) => id);
  const priceDict = await GetPrices(tcgplayerIds);
  return cards.map((card) => {
    const copy = { ...card };
    copy.details = { ...card.details };
    if (priceDict[copy.details.tcgplayer_id]) {
      copy.details.price = priceDict[copy.details.tcgplayer_id];
    }
    if (priceDict[`${copy.details.tcgplayer_id}'_foil`]) {
      copy.details.price_foil = priceDict[`${copy.details.tcgplayer_id}_foil`];
    }
    if (copy.price === undefined || copy.price === null) {
      if (copy.finish === 'Foil') {
        copy.price = copy.details.price_foil || copy.details.price;
      } else {
        copy.price = copy.details.price || copy.details.price_foil;
      }
    }
    return copy;
  });
}

module.exports = {
  addPrices,
  GetPrices,
};
