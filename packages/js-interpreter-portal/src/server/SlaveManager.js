import child_process from 'child_process';
import RPCInterface from './RPCInterface';
import Heroku from 'heroku-client';
import {ClientEvents} from '../constants';

@RPCInterface
export default class SlaveManager {
  constructor(io) {
    this.io = io;
    this.backends = [];
    if (process.env.HEROKU_API_TOKEN) {
      console.log('heroku api token present. Will use heroku for slaves');
      this.heroku = new Heroku({token: process.env.HEROKU_API_TOKEN});
    }
  }

  provisionBackend(id) {
    const subprocess = child_process.spawn('yarn', ['run', 'startSlave'], {
      env: {
        ...process.env,
        SLAVE_ID: id,
      },
      stdio: 'inherit',
    });
    this.backends.push({id, subprocess});
  }

  getBackend(id) {
    return this.backends.find(b => b.id === id);
  }

  getBackends = async () =>
    this.backends.map(({id, socketId}) => ({id, socketId}));

  registerBackend = async ({id}, socketId) => {
    console.log('registering backend', id);
    const backend = this.getBackend(id);
    if (backend) {
      backend.socketId = socketId;
    } else {
      this.backends.push({id, socketId});
    }
    this.io
      .to('clients')
      .emit(ClientEvents.SLAVE_MANAGER_STATE_CHANGE, await this.getBackends());
  };

  setNumBackends = async ({numBackends}) => {
    if (this.heroku) {
      console.log(
        'sending patch request to',
        `/apps/${process.env.HEROKU_APP_NAME}/formation/worker`
      );
      return await this.heroku.patch(
        `/apps/${process.env.HEROKU_APP_NAME}/formation/worker`,
        {body: {quantity: numBackends}}
      );
    }
    for (let i = this.backends.length; i < numBackends; i++) {
      this.provisionBackend(`slave-${i}`);
    }
  };
}
