const fs = require('fs');

if (fs.existsSync('../cubecobrasecrets')) {
  module.exports = {
    email: require('../cubecobrasecrets/email'),
    session: require('../cubecobrasecrets/secrets'),
    tcgplayer: require('../cubecobrasecrets/tcgplayer'),
  };
} else {
  module.exports = {
    email: {
      username: 'YOUR_EMAIL',
      password: 'YOUR_PASSWORD',
    },
    session: {
      session: 'VALUE',
    },
    tcgplayer: {},
  };
}
