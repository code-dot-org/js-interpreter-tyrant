import child_process from 'child_process';
import RPCInterface from './RPCInterface';
import Heroku from 'heroku-client';
import {ClientEvents} from '../constants';

@RPCInterface
export default class SlaveManager {
  state = {
    slaves: [],
    numThreads: 1,
  };

  constructor(io) {
    this.io = io;
    if (process.env.HEROKU_API_TOKEN) {
      console.log('heroku api token present. Will use heroku for slaves');
      this.heroku = new Heroku({token: process.env.HEROKU_API_TOKEN});
    }
  }

  setState(newState) {
    this.state = {...this.state, ...newState};
    this.io
      .to('clients')
      .emit(ClientEvents.SLAVE_MANAGER_STATE_CHANGE, this.state);
  }

  provisionBackend(id) {
    child_process.spawn('yarn', ['run', 'startSlave'], {
      env: {
        ...process.env,
        SLAVE_ID: id,
      },
      stdio: 'inherit',
    });
    this.setState({slaves: [...this.state.slaves, {id}]});
  }

  getBackend(id) {
    return this.state.slaves.find(b => b.id === id);
  }

  get backends() {
    return this.state.slaves;
  }

  getBackends = async () => this.state.slaves;
  getState = async () => this.state;

  registerBackend = async ({id}, socketId) => {
    console.log('registering backend', id);
    const backend = this.getBackend(id);
    if (backend) {
      backend.socketId = socketId;
      this.setState({
        slaves: this.state.slaves.map(
          s => (s.id === id ? {...s, socketId} : s)
        ),
      });
    } else {
      this.setState({slaves: [...this.state.slaves, {id, socketId}]});
    }
  };

  setConfig = async ({numBackends, numThreads}) => {
    if (numBackends) {
      await this.setNumBackends(numBackends);
    }
    if (numThreads) {
      this.state.slaves.forEach(({socketId}) => {
        this.io.to(socketId).emit('SlaveRunner.setNumThreads', {numThreads});
      });
      this.setState({numThreads});
    }
  };

  setNumBackends = async numBackends => {
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
    for (let i = this.state.slaves.length; i < numBackends; i++) {
      this.provisionBackend(`slave-${i}`);
    }
  };
}
