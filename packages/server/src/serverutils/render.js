// Load Environment Variables
require('dotenv').config();

const serialize = require('serialize-javascript');
const Cube = require('dynamo/models/cube');
const Notification = require('dynamo/models/notification');
const utils = require('./util');

const { NotificationStatus } = require('@utils/datatypes/Notification');
const { UserRoles } = require('@utils/datatypes/User');

const getCubes = async (req, callback) => {
  if (!req.user) {
    callback([]);
  } else {
    const query = await Cube.getByOwner(req.user.id);
    callback(query.items);
  }
};

const redirect = (req, res, to) => {
  if (req.session) {
    return req.session.save(() => {
      return res.redirect(to);
    });
  } else {
    return res.redirect(to);
  }
};

const getBundlesForPage = (page) => {
  //Webpack-dev-server doesn't do splitting, so only need to include the page bundle which gets compiled on the fly
  if (process.env?.NODE_ENV !== 'development') {
    return [`/js/vendors.bundle.js`, `/js/commons.bundle.js`, `/js/${page}.bundle.js`];
  } else {
    return [`/js/${page}.bundle.js`];
  }
};

const sha256 = async (data) => {
  const buffer = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map((b) => ('00' + b.toString(16)).slice(-2)).join('');
  return hashHex;
};

const render = (req, res, page, reactProps = {}, options = {}) => {
  getCubes(req, async (cubes) => {
    if (req.user) {
      const notifications = await Notification.getByToAndStatus(req.user.id, NotificationStatus.UNREAD);

      reactProps.user = {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        about: req.user.about,
        image: req.user.image,
        roles: req.user.roles,
        theme: req.user.theme,
        hideFeatured: req.user.hideFeatured,
        hideTagColors: req.user.hideTagColors,
        cubes,
        notifications: notifications.items,
        defaultPrinting: req.user.defaultPrinting,
        gridTightness: req.user.gridTightness,
        autoBlog: req.user.autoBlog,
        consentToHashedEmail: req.user.consentToHashedEmail,
        email_token: req.user.consentToHashedEmail ? await sha256(req.user.email) : '',
      };
    }

    reactProps.nitroPayEnabled = process.env.NITROPAY_ENABLED === 'true';
    reactProps.baseUrl = utils.getBaseUrl();
    reactProps.captchaSiteKey = process.env.CAPTCHA_SITE_KEY;
    if (res.locals.csrfToken) {
      reactProps.csrfToken = res.locals.csrfToken;
    }

    if (!options.metadata) {
      options.metadata = [];
    }
    if (!options.metadata.some((data) => data.property === 'og:image')) {
      options.metadata.push({
        property: 'og:image',
        content: '/content/sticker.png',
      });
    }

    try {
      const theme = (req && req.user && req.user.theme) || 'default';
      res.render('main', {
        reactHTML: null, // TODO renable ReactDOMServer.renderToString(React.createElement(page, reactProps)),
        reactProps: serialize(reactProps),
        bundles: getBundlesForPage(page),
        metadata: options.metadata,
        title: options.title ? `${options.title} - Cube Cobra` : 'Cube Cobra',
        patron: req.user && (req.user.roles || []).includes(UserRoles.PATRON),
        notice: process.env.NOTICE,
        theme,
        noindex: options.noindex || false,
      });
    } catch {
      res.status(500).send('Error rendering page');
    }
  });
};

const handleRouteError = function (req, res, err, reroute) {
  req.logger.error(err.message, err.stack);
  req.flash('danger', err.message);
  redirect(req, res, reroute);
};

module.exports = {
  render,
  redirect,
  handleRouteError,
};
