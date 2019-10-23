const path = require('path');
const merge = require('webpack-merge');

const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    compress: true,
    contentBase: path.join(__dirname, 'dist'),
    publicPath: '/js/',
    proxy: [{
      context: ['!/js/*.bundle.js', '**'],
      target: 'http://localhost:4999',
    }],
  },
  optimization: {
    usedExports: true,
  },
});