// Load Environment Variables
require('dotenv').config();

const serialize = require('serialize-javascript');
const Cube = require('../dynamo/models/cube');
const Notification = require('../dynamo/models/notification');

const getCubes = async (req, callback) => {
  if (!req.user) {
    callback([]);
  } else {
    const query = await Cube.getByOwner(req.user.id);
    callback(query.items);
  }
};

const redirect = (req, res, to) => {
  return req.session.save(() => {
    return res.redirect(to);
  });
}

const render = (req, res, page, reactProps = {}, options = {}) => {
  getCubes(req, async (cubes) => {
    if (req.user) {
      const notifications = await Notification.getByToAndStatus(req.user.id, Notification.STATUS.UNREAD);

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
      };
    }

    reactProps.loginCallback = req.baseUrl + req.path;
    reactProps.nitroPayEnabled = process.env.NITROPAY_ENABLED === 'true';
    reactProps.domain = process.env.DOMAIN;

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
      const theme =(req && req.user && req.user.theme) || 'default';
      res.render('main', {
        reactHTML: null, // TODO renable ReactDOMServer.renderToString(React.createElement(page, reactProps)),
        reactProps: serialize(reactProps),
        page,
        metadata: options.metadata,
        title: options.title ? `${options.title} - Cube Cobra` : 'Cube Cobra',
        patron: req.user && (req.user.roles || []).includes('Patron'),
        notice: process.env.NOTICE,
        theme
      });
    } catch {
      res.status(500).send('Error rendering page');
    }
  });
};

module.exports = {
  render,
  redirect
};
