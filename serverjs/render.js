// Load Environment Variables
require('dotenv').config();

const React = require('react');
const ReactDOMServer = require('react-dom/server');
const serialize = require('serialize-javascript');

const { NODE_ENV } = process.env;

const pages = {};
if (NODE_ENV === 'production') {
  pages.loading = require('../dist/pages/Loading').default;
  pages.dashboard = require('../dist/pages/DashboardPage').default;
}

const getPage = (page) => pages[page] || pages.loading;

const render = (req, res, page, reactProps) => {
  reactProps.user = req.user;

  return res.render('main', {
    reactHTML:
      NODE_ENV === 'production' ? ReactDOMServer.renderToString(React.createElement(getPage(page), reactProps)) : null,
    reactProps: serialize(reactProps),
    loginCallback: req.path,
    page,
  });
};

module.exports = {
  render,
};
