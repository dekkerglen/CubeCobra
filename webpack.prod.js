const { merge } = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

const common = require('./webpack.common');

const config = {
  mode: 'production',
  devtool: 'source-map',
  plugins: [
    new webpack.DefinePlugin({
      process: {
        env: {
          NODE_ENV: JSON.stringify('production'),
          DEBUG: false,
          NODE_DEBUG: false,
        },
      },
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true,
      debug: false,
    }),
    new webpack.IgnorePlugin({ resourceRegExp: /^(\.\/locale)|(moment)$/ }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
    ],
    usedExports: true,
  },
};

const clientConfig = merge(common.clientConfig, config, {});
const serverConfig = merge(common.serverConfig, config, {});

module.exports = [clientConfig, serverConfig];
