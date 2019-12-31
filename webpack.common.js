const path = require('path');
const merge = require('webpack-merge');
const nodeExternals = require('webpack-node-externals');

const config = {
  context: path.resolve(__dirname, 'src'),
  module: {
    rules: [{
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            configFile: path.resolve(__dirname, 'babel.config.js'),
          },
        },
      },
    ],
  },
  devtool: 'source-map',
};

const clientConfig = merge(config, {
  entry: {
    cube_analysis: './cube_analysis.js',
    cube_blog: './cube_blog.js',
    cube_compare: './cube_compare.js',
    cube_deck: './cube_deck.js',
    cube_deckbuilder: './cube_deckbuilder.js',
    cube_draft: './cube_draft.js',
    cube_list: './cube_list.js',
    cube_overview: './cube_overview.js',
    cube_playtest: './cube_playtest.js',
    topcards: './topcards.js',
    dashboard: './dashboard.js',
    blogpost: './blogpost.js',
    notifications: './notifications.js',
    cardpage: './cardpage.js'
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
    CubeListPage: './components/CubeListPage.js'
  },
  output: {
    filename: '[name].js',
    sourceMapFilename: '[name].js.map',
    path: path.resolve(__dirname, 'dist', 'components'),
    libraryTarget: 'commonjs2',
  },
  externals: [nodeExternals({ whitelist: ['react-tag-input', 'react-dnd', 'dnd-core', 'react-dnd-html5-backend'] })],
});

module.exports = { clientConfig, serverConfig };
