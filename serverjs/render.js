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
  pages.CubeGridDraftPage = require('../dist/pages/GridDraftPage').default;
  pages.ContactPage = require('../dist/pages/ContactPage').default;
  pages.InfoPage = require('../dist/pages/InfoPage').default;
  pages.DonatePage = require('../dist/pages/DonatePage').default;
  pages.DownTimePage = require('../dist/pages/DownTimePage').default;
  pages.FiltersPage = require('../dist/pages/FiltersPage').default;
  pages.CardSearchPage = require('../dist/pages/CardSearchPage').default;
  pages.TopCardsPage = require('../dist/pages/TopCardsPage').default;
  pages.CardPage = require('../dist/pages/CardPage').default;
  pages.CommentPage = require('../dist/pages/CommentPage').default;
  pages.LoginPage = require('../dist/pages/LoginPage').default;
  pages.RegisterPage = require('../dist/pages/RegisterPage').default;
  pages.LostPasswordPage = require('../dist/pages/LostPasswordPage').default;
  pages.NotificationsPage = require('../dist/pages/NotificationsPage').default;
  pages.PasswordResetPage = require('../dist/pages/PasswordResetPage').default;
  pages.UserAccountPage = require('../dist/pages/UserAccountPage').default;
  pages.UserBlogPage = require('../dist/pages/UserBlogPage').default;
  pages.UserDecksPage = require('../dist/pages/UserDecksPage').default;
  pages.UserSocialPage = require('../dist/pages/UserSocialPage').default;
  pages.UserCubePage = require('../dist/pages/UserCubePage').default;
  pages.ExplorePage = require('../dist/pages/ExplorePage').default;
  pages.SearchPage = require('../dist/pages/SearchPage').default;
  pages.RecentDraftsPage = require('../dist/pages/RecentDraftsPage').default;
  pages.VersionPage = require('../dist/pages/VersionPage').default;
  pages.AdminDashboardPage = require('../dist/pages/AdminDashboardPage').default;
  pages.ApplicationsPage = require('../dist/pages/ApplicationsPage').default;
  pages.CommentReportsPage = require('../dist/pages/CommentReportsPage').default;
  pages.CreatorsPage = require('../dist/pages/CreatorsPage').default;
  pages.MarkdownPage = require('../dist/pages/MarkdownPage').default;
  pages.ReviewArticlesPage = require('../dist/pages/ReviewArticlesPage').default;
  pages.ArticlesPage = require('../dist/pages/ArticlesPage').default;
}

const getPage = (page) => pages[page] || pages.Loading;

const render = (req, res, page, reactProps = {}, options = {}) => {
  reactProps.user = req.user
    ? {
        id: req.user._id,
        notifications: req.user.notifications,
        username: req.user.username,
        email: req.user.email,
        about: req.user.about,
        image: req.user.image,
        image_name: req.user.image_name,
        artist: req.user.artist,
        roles: req.user.roles,
      }
    : null;

  reactProps.loginCallback = req.baseUrl + req.path;

  return res.render('main', {
    reactHTML:
      NODE_ENV === 'production' ? ReactDOMServer.renderToString(React.createElement(getPage(page), reactProps)) : null,
    reactProps: serialize(reactProps),
    page,
    metadata: options.metadata ? options.metadata : null,
    title: options.title ? `${options.title} - Cube Cobra` : 'Cube Cobra',
  });
};

module.exports = {
  render,
};
