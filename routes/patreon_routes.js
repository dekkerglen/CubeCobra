// Load Environment Variables
require('dotenv').config();

const patreon = require('patreon');
const express = require('express');

const { render } = require('../serverjs/render');

const patreonAPI = patreon.patreon;
const patreonOAuth = patreon.oauth;

const patreonOAuthClient = patreonOAuth(process.env.CLIENT_ID, process.env.CLIENT_SECRET);

const router = express.Router();

router.get('/redirect', (req, res) => {
  const oauthGrantCode = req.query.code || 'asdf';

  patreonOAuthClient
    .getTokens(oauthGrantCode, process.env.PATREON_REDIRECT)
    .then((tokensResponse) => {
      const patreonAPIClient = patreonAPI(tokensResponse.access_token);
      return patreonAPIClient('/current_user');
    })
    .then(({ rawJson }) => {
      return render(req, res, 'ErrorPage', {
        requestId: req.uuid,
        title: '404: Page not found',
        details: rawJson,
      });
    })
    .catch((err) => {
      return render(req, res, 'ErrorPage', {
        error: err.statusText,
        requestId: req.uuid,
        title: 'There was an error linking your Patreon account.',
      });
    });
});

module.exports = router;
