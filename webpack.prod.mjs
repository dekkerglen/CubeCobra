import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';
import { merge } from 'webpack-merge';

import { clientConfig as commonClientConfig, serverConfig as commonServerConfig } from './webpack.common.mjs';

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
  infrastructureLogging: {
    level: 'verbose',
 }
};

const clientConfig = merge(commonClientConfig, config, {});
const serverConfig = merge(commonServerConfig, config, {});

export default [clientConfig, serverConfig];
