const path = require('path');
const fs = require('fs');

// Get a list of all files in the /src/pages/ directory
const pagesDirectory = path.resolve(__dirname, 'src/pages');
const pageFiles = fs.readdirSync(pagesDirectory);

// Create an entry object where each property is a page file (without the file extension)
const entry = pageFiles.reduce((entries, pageFile) => {
  const entryName = path.basename(pageFile, path.extname(pageFile));
  entries[entryName] = path.resolve(pagesDirectory, pageFile);
  return entries;
}, {});

module.exports = {
  entry,
  output: {
    filename: 'js/[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/', // Important for source maps to work correctly
  },
  devtool: 'eval-source-map', // Better source maps for development debugging
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: [/node_modules/, /\.stories\.tsx?$/, /\.\.\/server/, /packages\/server/],
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'tsconfig.json'),
            compilerOptions: {
              sourceMap: true, // Ensure TypeScript emits source maps
            },
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[path][name].[ext]',
              outputPath: 'images',
            },
          },
        ],
      },
    ],
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    proxy: [
      {
        context: '/',
        target: 'http://localhost:5000',
        secure: false,
        logLevel: 'info',
      },
    ],
    liveReload: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@utils': path.resolve(__dirname, '../utils/src'),
    },
    modules: [path.resolve(__dirname, 'src'), path.resolve(__dirname, '../utils/src'), 'node_modules'],
  },
  mode: 'development',
};
