// Load Environment Variables
require('dotenv').config();

const React = require('react');
const ReactDOMServer = require('react-dom/server');
const serialize = require('serialize-javascript');

const { NODE_ENV } = process.env;

const pages = {};
if (NODE_ENV === 'production') {
  pages.Loading = require('../dist/pages/Loading').default;
  pages.DashboardPage = require('../dist/pages/DashboardPage').default;
  pages.DevBlog = require('../dist/pages/DevBlog').default;
  pages.BlogPostPage = require('../dist/pages/BlogPostPage').default;
  pages.BulkUploadPage = require('../dist/pages/BulkUploadPage').default;
  pages.CubeComparePage = require('../dist/pages/CubeComparePage').default;
  pages.CubeAnalysisPage = require('../dist/pages/CubeAnalysisPage').default;
  pages.CubeBlogPage = require('../dist/pages/CubeBlogPage').default;
  pages.CubeDeckPage = require('../dist/pages/CubeDeckPage').default;
  pages.CubeDeckbuilderPage = require('../dist/pages/CubeDeckbuilderPage').default;
  pages.CubeDecksPage = require('../dist/pages/CubeDecksPage').default;
  pages.CubeDraftPage = require('../dist/pages/CubeDraftPage').default;
  pages.CubeListPage = require('../dist/pages/CubeListPage').default;
  pages.CubeOverviewPage = require('../dist/pages/CubeOverviewPage').default;
  pages.CubePlaytestPage = require('../dist/pages/CubePlaytestPage').default;
  pages.CubeSamplePackPage = require('../dist/pages/CubeSamplePackPage').default;
  pages.CubeGridDraftPage = require('../dist/pages/CubeGridDraftPage').default;
  pages.ContactPage = require('../dist/pages/ContactPage').default;
  pages.CookiesPage = require('../dist/pages/CookiesPage').default;
  pages.InfoPage = require('../dist/pages/InfoPage').default;
  pages.DonatePage = require('../dist/pages/DonatePage').default;
  pages.DownTimePage = require('../dist/pages/DownTimePage').default;
  pages.FiltersPage = require('../dist/pages/FiltersPage').default;
}

const getPage = (page) => pages[page] || pages.Loading;

const render = (req, res, page, reactProps = {}, options = {}) => {
  reactProps.user = req.user
    ? {
        id: req.user._id,
        notifications: req.user.notifications,
        username: req.user.username,
      }
    : null;

  return res.render('main', {
    reactHTML:
      NODE_ENV === 'production' ? ReactDOMServer.renderToString(React.createElement(getPage(page), reactProps)) : null,
    reactProps: serialize(reactProps),
    loginCallback: req.path,
    page,
    metadata: options.metadata ? options.metadata : null,
    title: options.title ? `${options.title} - Cube Cobra` : 'Cube Cobra',
  });
};

module.exports = {
  render,
};
