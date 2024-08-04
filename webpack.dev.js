import path from 'path';
import webpack from 'webpack';
import { merge } from 'webpack-merge';

import { clientConfig as commonClientConfig } from './webpack.common.js';

const config = {
  mode: 'development',
  devtool: 'inline-source-map',
  optimization: {
    usedExports: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      process: {
        env: {
          NODE_ENV: JSON.stringify('development'),
          DEBUG: true,
          NODE_DEBUG: false,
        },
      },
    }),
  ],
};

const clientConfig = merge(commonClientConfig, config, {
  devServer: {
    compress: true,
    devMiddleware: {
      publicPath: '/js/',
    },
    static: {
      directory: path.join(path.dirname(new URL(import.meta.url).pathname), 'dist'),
    },
    proxy: [
      {
        context: ['!/js/*.bundle.js', '**'],
        target: 'http://127.0.0.1:5000',
      },
    ],
  },
});

export default clientConfig;
