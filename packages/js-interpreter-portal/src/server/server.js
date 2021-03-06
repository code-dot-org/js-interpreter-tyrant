import express from 'express';
import { resolve } from 'path';
import compression from 'compression';
import SocketIO from 'socket.io';
import logger from './logger';
import theApp from './app';
import SocketAPI from './SocketAPI';
import { MASTER_PORT } from './constants';

const isProd = process.env.NODE_ENV === 'production';
const customHost = process.env.HOST;
const host = customHost || null; // Let http.Server use its default IPv6/4 host

const app = express();

function handleErrors(app) {
  return (req, res) => {
    app(req, res).catch(e => {
      console.error(e);
      res.status(500).send('There was an error :(');
      res.end();
    });
  };
}

if (isProd) {
  app.use(compression());
  app.use('/', express.static(resolve(process.cwd(), 'build')));
} else {
  const webpackConfig = require('../webpack/webpack.dev.babel');
  const webpack = require('webpack');
  const webpackDevMiddleware = require('webpack-dev-middleware');
  const webpackHotMiddleware = require('webpack-hot-middleware');
  const compiler = webpack(webpackConfig);
  const middleware = webpackDevMiddleware(compiler, {
    noInfo: true,
    publicPath: webpackConfig.output.publicPath,
    silent: true,
    stats: 'errors-only',
  });

  app.use(middleware);
  app.use(webpackHotMiddleware(compiler));
}

const server = app.listen(MASTER_PORT, host, err => {
  if (err) {
    return logger.error(err.message);
  }
});
console.log('listening on', host, MASTER_PORT);

const socketAPI = new SocketAPI(SocketIO(server), app);
console.log('ready to accept socket.io connections');

app.get('/test-results-new.json', (req, res) => {
  res.set('Content-Type', 'text/json');
  res.set(
    'Content-Disposition',
    'attachment; filename="test-results-new.json"'
  );
  res.end(JSON.stringify(socketAPI.masterRunner.latestResults, null, '  '));
});

app.get(/.*/, handleErrors(theApp));
