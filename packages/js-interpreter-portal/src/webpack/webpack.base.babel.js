/**
 * COMMON WEBPACK CONFIGURATION
 */

import path from 'path';
import webpack from 'webpack';

export default options => ({
  entry: options.entry,
  output: {
    // Compile into js/build.js
    path: path.resolve(process.cwd(), 'build'),
    publicPath: '/',
    ...options.output, // Merge with env dependent settings
  },
  module: {
    loaders: [
      {
        test: /\.js$/, // Transform all .js files required somewhere with Babel
        loader: 'babel-loader',
        include: [path.resolve(__dirname, '..')],
        query: options.babelQuery,
      },
    ],
  },
  plugins: options.plugins.concat([
    // Always expose NODE_ENV to webpack, in order to use `process.env.NODE_ENV`
    // inside your code for any environment checks; UglifyJS will automatically
    // drop any unreachable code.
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV),
        IS_CLIENT: true,
      },
    }),
    new webpack.NamedModulesPlugin(),
  ]),
  resolve: {
    extensions: ['.js', '.jsx', '.react.js'],
    mainFields: ['browser', 'jsnext:main', 'main'],
  },
  devtool: options.devtool,
  target: 'web', // Make web variables accessible to webpack, e.g. window
  performance: options.performance || {},
});
