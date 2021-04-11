// Load Environment Variables
require('dotenv').config();

const React = require('react');
const ReactDOMServer = require('react-dom/server');
const serialize = require('serialize-javascript');
const Cube = require('../models/cube');

const { NODE_ENV } = process.env;

const pages = {};
if (NODE_ENV === 'production') {
  pages.CardSearchPage = require('../dist/pages/CardSearchPage').default;
  pages.CommentPage = require('../dist/pages/CommentPage').default;
  pages.CommentReportsPage = require('../dist/pages/CommentReportsPage').default;
  pages.ContactPage = require('../dist/pages/ContactPage').default;
  pages.CreatorsPage = require('../dist/pages/CreatorsPage').default;
  pages.CubeAnalysisPage = require('../dist/pages/CubeAnalysisPage').default;
  pages.CubeBlogPage = require('../dist/pages/CubeBlogPage').default;
  pages.CubeComparePage = require('../dist/pages/CubeComparePage').default;
  pages.CubeDeckbuilderPage = require('../dist/pages/CubeDeckbuilderPage').default;
  pages.CubeDeckPage = require('../dist/pages/CubeDeckPage').default;
  pages.CubeDecksPage = require('../dist/pages/CubeDecksPage').default;
  pages.CubeDraftPage = require('../dist/pages/CubeDraftPage').default;
  pages.CubeListPage = require('../dist/pages/CubeListPage').default;
  pages.CubeOverviewPage = require('../dist/pages/CubeOverviewPage').default;
  pages.CubePlaytestPage = require('../dist/pages/CubePlaytestPage').default;
  pages.CubeSamplePackPage = require('../dist/pages/CubeSamplePackPage').default;
  pages.DashboardPage = require('../dist/pages/DashboardPage').default;
  pages.DevBlog = require('../dist/pages/DevBlog').default;
  pages.DonatePage = require('../dist/pages/DonatePage').default;
  pages.DownTimePage = require('../dist/pages/DownTimePage').default;
  pages.EditArticlePage = require('../dist/pages/EditArticlePage').default;
  pages.EditPodcastPage = require('../dist/pages/EditPodcastPage').default;
  pages.EditVideoPage = require('../dist/pages/EditVideoPage').default;
  pages.ErrorPage = require('../dist/pages/ErrorPage').default;
  pages.ExplorePage = require('../dist/pages/ExplorePage').default;
  pages.FiltersPage = require('../dist/pages/FiltersPage').default;
  pages.GridDraftPage = require('../dist/pages/GridDraftPage').default;
  pages.InfoPage = require('../dist/pages/InfoPage').default;
  pages.LandingPage = require('../dist/pages/LandingPage').default;
  pages.Loading = require('../dist/pages/Loading').default;
  pages.LoginPage = require('../dist/pages/LoginPage').default;
  pages.LostPasswordPage = require('../dist/pages/LostPasswordPage').default;
  pages.MarkdownPage = require('../dist/pages/MarkdownPage').default;
  pages.NotificationsPage = require('../dist/pages/NotificationsPage').default;
  pages.PasswordResetPage = require('../dist/pages/PasswordResetPage').default;
  pages.PodcastEpisodePage = require('../dist/pages/PodcastEpisodePage').default;
  pages.PodcastPage = require('../dist/pages/PodcastPage').default;
  pages.PodcastsPage = require('../dist/pages/PodcastsPage').default;
  pages.RecentDraftsPage = require('../dist/pages/RecentDraftsPage').default;
  pages.RegisterPage = require('../dist/pages/RegisterPage').default;
  pages.ReviewArticlesPage = require('../dist/pages/ReviewArticlesPage').default;
  pages.ReviewPodcastsPage = require('../dist/pages/ReviewPodcastsPage').default;
  pages.ReviewVideosPage = require('../dist/pages/ReviewVideosPage').default;
  pages.SearchPage = require('../dist/pages/SearchPage').default;
  pages.TopCardsPage = require('../dist/pages/TopCardsPage').default;
  pages.UserAccountPage = require('../dist/pages/UserAccountPage').default;
  pages.UserBlogPage = require('../dist/pages/UserBlogPage').default;
  pages.UserCubePage = require('../dist/pages/UserCubePage').default;
  pages.UserDecksPage = require('../dist/pages/UserDecksPage').default;
  pages.UserSocialPage = require('../dist/pages/UserSocialPage').default;
  pages.VersionPage = require('../dist/pages/VersionPage').default;
  pages.VideoPage = require('../dist/pages/VideoPage').default;
  pages.VideosPage = require('../dist/pages/VideosPage').default;
  pages.AdminCommentsPage = require('../dist/pages/AdminCommentsPage').default;
  pages.AdminDashboardPage = require('../dist/pages/AdminDashboardPage').default;
  pages.ApplicationPage = require('../dist/pages/ApplicationPage').default;
  pages.ApplicationsPage = require('../dist/pages/ApplicationsPage').default;
  pages.ArticlePage = require('../dist/pages/ArticlePage').default;
  pages.ArticlesPage = require('../dist/pages/ArticlesPage').default;
  pages.BlogPostPage = require('../dist/pages/BlogPostPage').default;
  pages.BrowseContentPage = require('../dist/pages/BrowseContentPage').default;
  pages.BulkUploadPage = require('../dist/pages/BulkUploadPage').default;
  pages.CardPage = require('../dist/pages/CardPage').default;
  pages.LeaveWarningPage = require('../dist/pages/LeaveWarningPage').default;
  pages.BrowsePackagesPage = require('../dist/pages/BrowsePackagesPage').default;
}

const getPage = (page) => pages[page] || pages.Loading;

const getCubes = (req, callback) => {
  if (!req.user) {
    callback([]);
  } else {
    Cube.find({ owner: req.user._id }, '_id name')
      .sort({ date_updated: -1 })
      .lean()
      .exec((err, docs) => {
        if (err) {
          callback([]);
        } else {
          callback(docs);
        }
      });
  }
};

const render = (req, res, page, reactProps = {}, options = {}) => {
  getCubes(req, (cubes) => {
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
          theme: req.user.theme,
          hide_featured: req.user.hide_featured,
          cubes,
        }
      : null;

    reactProps.loginCallback = req.baseUrl + req.path;

    if (!options.metadata) {
      options.metadata = [];
    }
    if (!options.metadata.some((data) => data.property === 'og:image')) {
      options.metadata.push({
        property: 'og:image',
        content: '/content/sticker.png',
      });
    }

    res.render('main', {
      reactHTML:
        NODE_ENV === 'production'
          ? ReactDOMServer.renderToString(React.createElement(getPage(page), reactProps))
          : null,
      reactProps: serialize(reactProps),
      page,
      metadata: options.metadata,
      title: options.title ? `${options.title} - Cube Cobra` : 'Cube Cobra',
      colors: req.user && req.user.theme ? `/css/${req.user.theme}.css` : '/css/default.css',
    });
  });
};

module.exports = {
  render,
};
