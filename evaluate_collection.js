var carddb = require('./serverjs/cards.js');
var prices = require('./serverjs/prices.js');

const fs = require('fs');
const parse = require('csv-parse');
const stringify = require('csv-stringify')

const input = [];

// Using the first line of the CSV data to discover the column names
rs = fs.createReadStream('./private/input.csv');
parser = parse({columns: true}, function(err, data){
    data.forEach(function(line, index) {
        const options = carddb.nameToId[line.Name.toLowerCase()];
        if(!options) {
            console.log("Not found: " + line.Name);
        } else {
            options.forEach(function(option, index) {
                if(line.Edition)
                {
                    if(carddb.cardFromId(option).set_name.toLowerCase() == line.Edition.toLowerCase())
                    {
                        line.tcgplayer_id = carddb.cardFromId(option).tcgplayer_id;
                    }
                }
            });
        }
    })

    const ids = [];
    data.forEach(function(line, index) {
        if(line.tcgplayer_id) {
            ids.push(line.tcgplayer_id)
        }
    });
    prices.GetPrices(ids, function(prices){
        
        data.forEach(function(line, index) {
            if(line.tcgplayer_id) {
                line.price = prices[line.tcgplayer_id];
                line.price_foil = prices[line.tcgplayer_id + "_foil"];
            }
        });
        
        stringify( data, {
            columns: [ 'Name','Edition','Card Number','Condition','Language','Foil','Signed','Quantity','Unit Price','Total Price','Photo Number','price','price_foil','tcgplayer_id' ]
          }, function(err, output){
              fs.writeFile('./private/output.csv', output, (err) => {
                // throws an error, you could also catch it here
                if (err) throw err;
            
                // success case, the file was saved
                console.log("done");
            });
          })

    });

});

(async () => {
    await carddb.initializeCardDb();
    rs.pipe(parser);
})();