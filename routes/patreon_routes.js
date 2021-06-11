// Load Environment Variables
require('dotenv').config();

const patreon = require('patreon');
const express = require('express');

const util = require('../serverjs/util.js');
const { render } = require('../serverjs/render');

const patreonAPI = patreon.patreon;
const patreonOAuth = patreon.oauth;

const patreonOAuthClient = patreonOAuth(process.env.CLIENT_ID, process.env.CLIENT_SECRET);

const router = express.Router();

router.get('/redirect', async (req, res) => {
  try {
    const oauthGrantCode = req.query.code;

    const tokensResponse = await patreonOAuthClient.getTokens(oauthGrantCode, process.env.PATREON_REDIRECT);
    const patreonAPIClient = patreonAPI(tokensResponse.access_token);
    const result = patreonAPIClient('/current_user');

    return render(req, res, 'ErrorPage', {
      requestId: req.uuid,
      title: '404: Page not found',
      details: result,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, `/user/account?nav=patreon`);
  }
});

module.exports = router;
