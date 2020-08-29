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
    blogpost: './src/blogpost.js',
    bulk_upload: './src/bulk_upload.js',
    cardpage: './src/cardpage.js',
    cube_samplepack: './src/cube_samplepack.js',
    cube_analysis: './src/cube_analysis.js',
    cube_blog: './src/cube_blog.js',
    cube_compare: './src/cube_compare.js',
    cube_deck: './src/cube_deck.js',
    cube_decks: './src/cube_decks.js',
    cube_deckbuilder: './src/cube_deckbuilder.js',
    cube_draft: './src/cube_draft.js',
    cube_list: './src/cube_list.js',
    cube_overview: './src/cube_overview.js',
    cube_playtest: './src/cube_playtest.js',
    dashboard: './src/dashboard.js',
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
    gridDraft: './src/gridDraft.js',
    recent_drafts: './src/recent_drafts.js',
    cardsearch: './src/cardsearch.js',
    comment: './src/comment.js',
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
    'pages/BulkUploadPage': './src/pages/BulkUploadPage.js',
    'pages/CubeDraftPage': './src/pages/CubeDraftPage.js',
    'pages/CubeListPage': './src/pages/CubeListPage.js',
    'pages/CubePlaytestPage': './src/pages/CubePlaytestPage.js',
    'pages/DashboardPage': './src/pages/DashboardPage.js',
    'utils/Card': './src/utils/Card.js',
    'utils/draftutil': './src/utils/draftutil.js',
    'utils/Draft': './src/utils/Draft.js',
    'filtering/FilterCards': './src/filtering/FilterCards.js',
    'utils/Sort': './src/utils/Sort.js',
    'utils/Util': './src/utils/Util.js',
    'utils/deckutils': './src/utils/deckutils.js',
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
