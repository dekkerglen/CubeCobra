const path = require('path');

module.exports = {
  context: path.resolve(__dirname, 'src'),
  entry: {
    cube_analysis: ['./cube_analysis.js'],
    cube_compare: ['./cube_compare.js'],
    cube_list: ['./cube_list.js'],
    cube_playtest: ['./cube_playtest.js'],
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
            '@babel/preset-env',
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