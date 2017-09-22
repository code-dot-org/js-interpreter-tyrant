import yargs from 'yargs';
import uuid from 'uuid/v4';

import Backend from './Backend';
import {MASTER_PORT} from '../server/constants';
import Connection from '../client/Connection';

let DEFAULT_MASTER = `http://localhost:${MASTER_PORT}`;

if (process.env.HEROKU_APP_NAME) {
  DEFAULT_MASTER = `http://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
}
const ARGS = yargs
  .usage(`Usage: $0 [options]`)
  .describe('id', 'backend id')
  .nargs('id', 1)
  .default('id', process.env.SLAVE_ID || process.env.DYNO || uuid())
  .describe('master', 'master server to contact')
  .nargs('master', 1)
  .default('master', DEFAULT_MASTER)
  .help('h')
  .alias('h', 'help');

console.log('Starting up backend');
Connection.initClient({
  url: ARGS.argv.master + '?type=backend',
  callback: socket => new Backend(socket, ARGS.argv),
});
