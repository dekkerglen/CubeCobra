const path = require('path');
const { merge} = require('webpack-merge');
const webpack = require('webpack');
const common = require('./webpack.common');

const config = {
  mode: 'development',
  devtool: 'inline-source-map',
  optimization: {
    usedExports: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.DEBUG': true,
      'process.env.NODE_DEBUG': true,
    }),
  ],
};

const clientConfig = merge(common.clientConfig, config, {
  devServer: {
    compress: true,
    devMiddleware: {
      publicPath: '/js/',
    },
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    proxy: [
      {
        context: ['!/js/*.bundle.js', '**'],
        target: 'http://127.0.0.1:5000',
      },
    ],
  },
});

module.exports = clientConfig;
