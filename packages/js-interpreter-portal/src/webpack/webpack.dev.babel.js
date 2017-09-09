/**
 * DEVELOPMENT WEBPACK CONFIGURATION
 */

import path from 'path';
import fs from 'fs';
import webpack from 'webpack';
import logger from '../server/logger';
import base from './webpack.base.babel';

const plugins = [
  new webpack.optimize.CommonsChunkPlugin({
    name: 'vendor',
    children: true,
    minChunks: 2,
    async: true,
  }),
  new webpack.HotModuleReplacementPlugin(), // Tell webpack we want hot reloading
  new webpack.NoEmitOnErrorsPlugin(),
];

module.exports = base({
  // Add hot reloading in development
  entry: [
    'webpack-hot-middleware/client?reload=true',
    path.join(process.cwd(), 'src/client/app.js'),
  ],

  // Don't use hashes in dev mode for better performance
  output: {
    filename: '[name].js',
    chunkFilename: '[name].chunk.js',
  },

  // Add development plugins
  plugins, // eslint-disable-line no-use-before-define

  // Tell babel that we want to hot-reload
  babelQuery: {
    // require.resolve solves the issue of relative presets when dealing with
    // locally linked packages. This is an issue with babel and webpack.
    // See https://github.com/babel/babel-loader/issues/149 and
    // https://github.com/webpack/webpack/issues/1866
    presets: ['babel-preset-react-hmre'].map(require.resolve),
  },

  // Emit a source map for easier debugging
  devtool: 'eval',

  performance: {
    hints: false,
  },
});
