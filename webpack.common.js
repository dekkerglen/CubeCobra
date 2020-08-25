const path = require('path');
const merge = require('webpack-merge');
const nodeExternals = require('webpack-node-externals');

const config = {
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules[\/\\](?!react-dnd|dnd-core)/,
        use: {
          loader: 'babel-loader',
          options: {
            configFile: path.resolve(__dirname, 'babel.config.js'),
          },
        },
      },
      {
        test: /\.(css|less)$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  devtool: 'source-map',
  resolve: {
    modules: ['src', 'node_modules'],
  },
};

const clientConfig = merge(config, {
  entry: {
    BlogPostPage: './src/pages/BlogPostPage.js',
    BulkUploadPage: './src/pages/BulkUploadPage.js',
    cardpage: './src/cardpage.js',
    CubeSamplePackPage: './src/pages/CubeSamplePackPage.js',
    CubeAnalysisPage: './src/pages/CubeAnalysisPage.js',
    CubeBlogPage: './src/pages/CubeBlogPage.js',
    CubeComparePage: './src/pages/CubeComparePage.js',
    CubeDeckPage: './src/pages/CubeDeckPage.js',
    CubeDecksPage: './src/pages/CubeDecksPage.js',
    CubeDeckbuilderPage: './src/pages/CubeDeckbuilderPage.js',
    CubeDraftPage: './src/pages/CubeDraftPage.js',
    CubeListPage: './src/pages/CubeListPage.js',
    CubeOverviewPage: './src/pages/CubeOverviewPage.js',
    CubePlaytestPage: './src/pages/CubePlaytestPage.js',
    DashboardPage: './src/pages/DashboardPage.js',
    notifications: './src/notifications.js',
    topcards: './src/topcards.js',
    user_account: './src/user_account.js',
    user_decks: './src/user_decks.js',
    user_social: './src/user_social.js',
    user_view: './src/user_view.js',
    explore: './src/explore.js',
    search: './src/search.js',
    version: './src/version.js',
    user_blog: './src/user_blog.js',
    GridDraftPage: './src/pages/GridDraftPage.js',
    recent_drafts: './src/recent_drafts.js',
    cardsearch: './src/cardsearch.js',
    comment: './src/comment.js',
    DevBlog: './src/pages/DevBlog.js',
    ContactPage: './src/pages/ContactPage.js',
    DonatePage: './src/pages/DonatePage.js',
    InfoPage: './src/pages/InfoPage.js',
    FiltersPage: './src/pages/FiltersPage.js',
    DownTimePage: './src/pages/DownTimePage.js',
    login: './src/login.js',
    lostpassword: './src/lostpassword.js',
    passwordreset: './src/passwordreset.js',
    register: './src/register.js',
  },
  output: {
    filename: '[name].bundle.js',
    sourceMapFilename: '[name].js.map',
    path: path.resolve(__dirname, 'dist'),
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },
});

const serverConfig = merge(config, {
  target: 'node',
  entry: {
    'pages/DashboardPage': './src/pages/DashboardPage.js',
    'pages/DevBlog': './src/pages/DevBlog.js',
    'pages/Loading': './src/pages/Loading.js',
    'pages/BlogPostPage': './src/pages/BlogPostPage.js',
    'pages/BulkUploadPage': './src/pages/BulkUploadPage.js',
    'pages/CubeAnalysisPage': './src/pages/CubeAnalysisPage.js',
    'pages/CubeBlogPage': './src/pages/CubeBlogPage.js',
    'pages/CubeComparePage': './src/pages/CubeComparePage.js',
    'pages/CubeDeckPage': './src/pages/CubeDeckPage.js',
    'pages/CubeDeckbuilderPage': './src/pages/CubeDeckbuilderPage.js',
    'pages/CubeDecksPage': './src/pages/CubeDecksPage.js',
    'pages/CubeDraftPage': './src/pages/CubeDraftPage.js',
    'pages/CubeListPage': './src/pages/CubeListPage.js',
    'pages/CubeOverviewPage': './src/pages/CubeOverviewPage.js',
    'pages/CubePlaytestPage': './src/pages/CubePlaytestPage.js',
    'pages/CubeSamplePackPage': './src/pages/CubeSamplePackPage.js',
    'pages/GridDraftPage': './src/pages/GridDraftPage.js',
    'pages/ContactPage': './src/pages/ContactPage.js',
    'pages/InfoPage': './src/pages/InfoPage.js',
    'pages/DonatePage': './src/pages/DonatePage.js',
    'pages/DownTimePage': './src/pages/DownTimePage.js',
    'pages/FiltersPage': './src/pages/FiltersPage.js',
    'utils/Card': './src/utils/Card.js',
    'utils/draftutil': './src/utils/draftutil.js',
    'utils/Draft': './src/utils/Draft.js',
    'filtering/FilterCards': './src/filtering/FilterCards.js',
    'utils/Sort': './src/utils/Sort.js',
    'utils/Util': './src/utils/Util.js',
  },
  output: {
    filename: '[name].js',
    sourceMapFilename: '[name].js.map',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2',
  },
  externals: [
    nodeExternals({
      whitelist: ['react-tag-input', 'react-dnd', 'dnd-core', 'react-dnd-html5-backend', 'react-dnd-touch-backend'],
    }),
  ],
});

module.exports = { clientConfig, serverConfig };
