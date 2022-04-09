const path = require('path');
const merge = require('webpack-merge');

const common = require('./webpack.common');

const config = {
  mode: 'development',
  devtool: 'inline-source-map',
  optimization: {
    usedExports: true,
  },
};

const clientConfig = merge(common.clientConfig, config, {
  devServer: {
    compress: true,
    contentBase: path.join(__dirname, 'dist'),
    publicPath: '/js/',
    proxy: [
      {
        context: ['!/js/*.bundle.js', '**'],
        target: 'http://127.0.0.1:5000',
      },
    ],
  },
});

module.exports = clientConfig;
