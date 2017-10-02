import child_process from 'child_process';
import RPCInterface from './RPCInterface';
import Heroku from 'heroku-client';

@RPCInterface({type: 'master'})
export default class SlaveManager {
  clientState = {
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

  provisionBackend(id) {
    child_process.spawn('yarn', ['run', 'startSlave'], {
      env: {
        ...process.env,
        SLAVE_ID: id,
      },
      stdio: 'inherit',
    });
    this.setClientState({slaves: [...this.clientState.slaves, {id}]});
  }

  getBackend(id) {
    return this.clientState.slaves.find(b => b.id === id);
  }

  get backends() {
    return this.clientState.slaves;
  }

  getBackends = async () => this.clientState.slaves;

  registerBackend = async ({id}, socketId) => {
    const backend = this.getBackend(id);
    if (backend) {
      backend.socketId = socketId;
      this.setClientState({
        slaves: this.clientState.slaves.map(
          s => (s.id === id ? {...s, socketId} : s)
        ),
      });
    } else {
      this.setClientState({
        slaves: [...this.clientState.slaves, {id, socketId}],
      });
    }
  };

  setConfig = async ({numBackends, numThreads}) => {
    if (numBackends) {
      await this.setNumBackends(numBackends);
    }
    if (numThreads) {
      this.clientState.slaves.forEach(({socketId}) => {
        this.io.to(socketId).emit('SlaveRunner.setNumThreads', {numThreads});
      });
      this.setClientState({numThreads});
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
    for (let i = this.clientState.slaves.length; i < numBackends; i++) {
      this.provisionBackend(`slave-${i}`);
    }
  };
}
