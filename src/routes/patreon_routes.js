// Load Environment Variables
require('dotenv').config();

const patreon = require('patreon');
const express = require('express');

const { ensureAuth } = require('./middleware');
const util = require('../util/util');

const Patron = require('../dynamo/models/patron');
const User = require('../dynamo/models/user');
const { redirect } = require('../util/render');

const patreonAPI = patreon.patreon;
const patreonOAuth = patreon.oauth;

const patreonOAuthClient = patreonOAuth(process.env.PATREON_CLIENT_ID, process.env.PATREON_CLIENT_SECRET);

const router = express.Router();

const isValidPatreonSignature = (signature, body) => {
  const hmac = crypto.createHmac('md5', process.env.PATREON_HOOK_SECRET);
  const data = hmac.update(JSON.stringify(body));
  const digest = data.digest('hex');

  return digest === signature;
};

router.get('/unlink', ensureAuth, async (req, res) => {
  try {
    await Patron.deleteById(req.user.id);

    const user = await User.getById(req.user.id);
    user.roles = user.roles.filter((role) => role !== 'Patron');
    user.Patron = undefined;
    await User.update(user);

    req.flash('success', `Patron account has been unlinked.`);
    return redirect(req, res, '/user/account?nav=patreon');
  } catch (err) {
    return util.handleRouteError(req, res, err, '/user/account?nav=patreon');
  }
});

router.post('/hook', async (req, res) => {
  try {
    const action = req.headers['x-patreon-event'];
    const signature = req.headers['x-patreon-signature'];

    if (!isValidPatreonSignature(signature, req.body)) {
      return res.status(401).send({
        success: 'false',
      });
    }

    const { included, data } = req.body;

    const users = included.filter((item) => item.id === data.relationships.patron.data.id);

    if (users.length !== 1) {
      req.logger.error('Recieved a patreon hook with not exactly one user');
      return res.status(500).send({
        success: 'false',
      });
    }
    const email = users[0].attributes.email.toLowerCase();

    // if a patron with this email is already linked, we can't use it
    const document = await Patron.getByEmail(email);

    if (!document) {
      req.logger.error(`Recieved a patreon hook without a found email: "${email}"`);

      return res.status(200).send({
        success: 'false',
      });
    }

    const user = await User.getById(document.owner);

    if (!user) {
      req.logger.error(`Recieved a patreon hook without a found user: "${document.owner.id}"`);

      return res.status(200).send({
        success: 'false',
      });
    }

    if (action === 'pledges:update' || action === 'pledges:create') {
      const rewardId = data.relationships.reward.data.id;
      const rewards = included.filter((item) => item.id === rewardId);

      if (rewards.length === 0) {
        document.level = 0;
      } else {
        document.level = Patron.LEVELS.indexOf(rewards[0].attributes.title);
      }

      document.status = Patron.STATUSES.ACTIVE;
      if (!user.roles.includes('Patron')) {
        user.roles.push('Patron');
      }
    } else if (action === 'pledges:delete') {
      document.status = Patron.STATUSES.INACTIVE;
      user.roles = user.roles.filter((role) => role !== 'Patron');
    } else {
      req.logger.error(`Recieved an unsupported patreon hook action: "${action}"`);
      return res.status(500).send({
        success: 'false',
      });
    }

    await Patron.put(document);
    await User.update(user);

    return res.status(200).send({
      success: 'false',
    });
  } catch (err) {
    req.logger.error(err.message, err.stack);
    return res.status(500).send({
      success: 'false',
    });
  }
});

router.get('/redirect', ensureAuth, async (req, res) => {
  const oauthGrantCode = req.query.code;

  const patron = await Patron.getById(req.user.id);

  // if this user is already a patron, error
  if (patron && patron.status === Patron.STATUSES.ACTIVE) {
    req.flash('danger', `A Patreon account has already been linked.`);
    return redirect(req, res, '/user/account?nav=patreon');
  }

  return patreonOAuthClient
    .getTokens(oauthGrantCode, process.env.PATREON_REDIRECT)
    .then((tokensResponse) => {
      const patreonAPIClient = patreonAPI(tokensResponse.access_token);
      return patreonAPIClient('/current_user');
    })
    .then(async ({ rawJson }) => {
      // use email for unique key
      const email = rawJson.data.attributes.email.toLowerCase();

      // if a patron with this email is already linked, we can't use it
      const document = await Patron.getByEmail(email);

      if (document) {
        req.flash(
          'danger',
          `This Patreon account has already been linked to another Cube Cobra account. If you think this was done by mistake, please contact us.`,
        );
        return redirect(req, res, '/user/account?nav=patreon');
      }

      const newPatron = {
        email,
        owner: req.user.id,
        status: Patron.STATUSES.INACTIVE,
      };
      if (!rawJson.included) {
        req.flash('danger', `This Patreon account does not appear to be currently support Cube Cobra.`);
        return redirect(req, res, '/user/account?nav=patreon');
      }

      const pledges = rawJson.included.filter((item) => item.type === 'pledge');

      if (pledges.length === 0) {
        req.flash('danger', `This Patreon account does not appear to be currently support Cube Cobra.`);
        return redirect(req, res, '/user/account?nav=patreon');
      }

      if (pledges.length > 1) {
        req.flash('danger', `The server response from Patreon was malformed. Please contact us for more information.`);
        return redirect(req, res, '/user/account?nav=patreon');
      }

      if (!pledges[0].relationships.reward || !pledges[0].relationships.reward.data) {
        newPatron.level = 0;
      } else {
        const rewardId = pledges[0].relationships.reward.data.id;

        const rewards = rawJson.included.filter((item) => item.id === rewardId);

        if (rewards.length > 1) {
          req.flash(
            'danger',
            `The server response from Patreon was malformed, too many reward objects. Please contact us for more information.`,
          );
          return redirect(req, res, '/user/account?nav=patreon');
        }

        if (rewards.length === 0) {
          newPatron.level = 0;
        } else {
          newPatron.level = Patron.LEVELS.indexOf(rewards[0].attributes.title);
        }
      }

      newPatron.status = Patron.STATUSES.ACTIVE;

      await Patron.put(newPatron);

      const user = await User.getById(req.user.id);
      if (!user.roles.includes('Patron')) {
        user.roles.push('Patron');
      }
      await User.update(user);

      if (newPatron.level === 0) {
        req.flash(
          'warning',
          "Your pledge isn't tied to any support tiers. Choose an eligible tier on Patreon to get access to all your rewards.",
        );
      }
      req.flash('success', `Your Patreon account has successfully been linked.`);
      return redirect(req, res, '/user/account?nav=patreon');
    })
    .catch((err) => {
      console.error(err);
      req.logger.error(err.message, err.stack, JSON.stringify(err));

      req.flash('danger', `There was an error linking your Patreon account: ${err.message}`);
      return redirect(req, res, '/user/account?nav=patreon');
    });
});

module.exports = router;
