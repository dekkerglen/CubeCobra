const path = require('path');

module.exports = {
  context: path.resolve(__dirname, 'src'),
  entry: {
    cube_analysis: ['./cube_analysis.js'],
    cube_blog: ['./cube_blog.js'],
    cube_compare: ['./cube_compare.js'],
    cube_deckbuilder: ['./cube_deckbuilder.js'],
    cube_draft: ['./cube_draft.js'],
    cube_list: ['./cube_list.js'],
    cube_overview: ['./cube_overview.js'],
    cube_playtest: ['./cube_playtest.js'],
    topcards: ['./topcards.js'],
    dashboard: ['./dashboard.js'],
    blogpost: ['./blogpost.js'],
    notifications: ['./notifications.js'],
    cardpage: ['./cardpage.js']
  },
  output: {
    filename: '[name].bundle.js',
    sourceMapFilename: '[name].js.map',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [{
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          presets: [
            ['@babel/preset-env', {
              'useBuiltIns': 'usage',
              'corejs': 2,
            }],
            '@babel/preset-react',
          ],
        },
      },
    ],
  },
  /*externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },*/
  devtool: 'source-map',
};
