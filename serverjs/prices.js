const request = require('request');
const fetch = require('node-fetch');
const tcgconfig = require('../../cubecobrasecrets/tcgplayer');

var token = null;
const cached_prices = {};

function GetToken(callback) {
  if (token && Date.now() < token.expires) {
    //TODO: check if token is expired, if so, fetch a new one
    callback(token.access_token);
  } else {
    console.log(Date(Date.now()).toString(), 'fetching fresh token');
    var options = {
      url: 'https://api.tcgplayer.com/token',
      method: 'POST',
      header: 'application/x-www-form-urlencoded',
      body:
        'grant_type=client_credentials&client_id=' + tcgconfig.Public_Key + '&client_secret=' + tcgconfig.Private_Key,
    };

    request(options, function(error, response, body) {
      if (error) {
        console.log(error);
        callback();
      } else {
        token = JSON.parse(body);
        token.expires = Tomorrow();
        console.log(token.expires.toString());
        callback(token.access_token);
      }
    });
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

function listToString(list) {
  var str = '';
  list.forEach(function(item, index) {
    if (index != 0) {
      str += ',';
    }
    str += item;
  });
  return str;
}

function parseJSON(response) {
  return response.json();
}

//callback with a dict of card prices
function GetPrices(card_ids, callback) {
  var price_dict = {};

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

  if (card_ids.length > 0) {
    var chunkSize = 250;
    //max tcgplayer request size is 250
    var chunks = [];
    for (i = 0; i < card_ids.length / chunkSize; i++) {
      chunks.push(card_ids.slice(i * chunkSize, (i + 1) * chunkSize));
    }

    GetToken(function(access_token) {
      Promise.all(
        chunks.map((chunk) =>
          fetch('http://api.tcgplayer.com/v1.32.0/pricing/product/' + listToString(chunk), {
            headers: {
              Authorization: ' Bearer ' + access_token,
            },
            method: 'GET',
          })
            .then(checkStatus)
            .then(parseJSON),
        ),
      )
        .then(function(responses) {
          responses.forEach(function(response, index) {
            response.results.forEach(function(item, index) {
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
            });
          });
          callback(price_dict);
        })
        .catch(function(error) {
          console.log('error: ' + error);
          callback({});
        });
    });
  } else {
    callback(price_dict);
  }
}

module.exports = {
  GetPrices: GetPrices,
};
