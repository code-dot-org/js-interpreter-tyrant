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

  provisionSlave(id) {
    child_process.spawn('yarn', ['run', 'startSlave'], {
      env: {
        ...process.env,
        SLAVE_ID: id,
      },
      stdio: 'inherit',
    });
    this.setClientState({slaves: [...this.clientState.slaves, {id}]});
  }

  getSlave(id) {
    return this.clientState.slaves.find(b => b.id === id);
  }

  get slaves() {
    return this.clientState.slaves;
  }

  getSlaves = async () => this.clientState.slaves;

  getSocketIdx(index) {
    return this.io.sockets.connected[this.slaves[index].socketId];
  }

  getSocketFor(slave) {
    return this.io.sockets.connected[slave.socketId];
  }

  async emitPrimarySlave(event, ...args) {
    return await new Promise(resolve =>
      this.getSocketIdx(0).emit(event, ...args, resolve)
    );
  }

  async emitToAllSlaves(event, ...args) {
    return await Promise.all(
      this.slaves.map(
        async slave => await this.getSocketFor(slave).emit(event, ...args)
      )
    );
  }

  registerSlave = async ({id}, socketId) => {
    const slave = this.getSlave(id);
    if (slave) {
      slave.socketId = socketId;
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

  setConfig = async ({numSlaves, numThreads}) => {
    if (numSlaves) {
      await this.setNumSlaves(numSlaves);
    }
    if (numThreads) {
      this.clientState.slaves.forEach(({socketId}) => {
        this.io.to(socketId).emit('SlaveRunner.setNumThreads', {numThreads});
      });
      this.setClientState({numThreads});
    }
  };

  setNumSlaves = async numSlaves => {
    if (this.heroku) {
      console.log(
        'sending patch request to',
        `/apps/${process.env.HEROKU_APP_NAME}/formation/worker`
      );
      return await this.heroku.patch(
        `/apps/${process.env.HEROKU_APP_NAME}/formation/worker`,
        {body: {quantity: numSlaves}}
      );
    }
    for (let i = this.clientState.slaves.length; i < numSlaves; i++) {
      this.provisionSlave(`slave-${i}`);
    }
  };
}
