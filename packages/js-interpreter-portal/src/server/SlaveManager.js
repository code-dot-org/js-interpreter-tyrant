import child_process from 'child_process';
import RPCInterface from './RPCInterface';
import Heroku from 'heroku-client';
import sortBy from 'lodash.sortby';

@RPCInterface({ type: 'master' })
export default class SlaveManager {
  clientState = {
    slaves: [],
  };

  childProcesses = {};
  workers = {};

  constructor(io) {
    this.io = io;
    if (process.env.HEROKU_API_TOKEN) {
      console.log('heroku api token present. Will use heroku for slaves');
      this.heroku = new Heroku({ token: process.env.HEROKU_API_TOKEN });
    }
  }

  provisionSlave(id) {
    console.log('Starting slave', id);
    this.childProcesses[id] = child_process.spawn(
      'yarn',
      ['run', 'startSlave'],
      {
        env: {
          ...process.env,
          SLAVE_ID: id,
        },
        stdio: 'inherit',
      }
    );
  }

  async destroySlave(id) {
    await this.emitToSlave(this.getSlave(id), 'Slave.kill');
    if (this.heroku) {
      console.log('destroying slave', id);
      await this.heroku.post(
        `/apps/${process.env.HEROKU_APP_NAME}/dynos/${id}/actions/stop`
      );
    }
    await this.deregisterSlave({ id });
  }

  setSlave(id, state) {
    let found = false;
    let slaves = this.clientState.slaves.map(s => {
      if (s.id === id) {
        found = true;
        return { ...s, ...state };
      }
      return s;
    });
    if (!found) {
      slaves.push({ id, ...state });
      slaves = sortBy(slaves, s => parseInt(s.id.split('.')[1]));
    }
    this.setClientState({
      slaves,
    });
  }

  getSlave(id) {
    return this.clientState.slaves.find(b => b.id === id);
  }

  get slaves() {
    return this.clientState.slaves;
  }

  restartSlave = async slave => {
    this.setSlave(slave.id, { restarting: true });
    if (this.heroku) {
      await this.heroku.delete(
        `/apps/${process.env.HEROKU_APP_NAME}/dynos/${slave.id}`
      );
    } else {
      console.log('Restarting slave', slave.id);
      this.emitToSlave(slave, 'SlaveRunner.kill');
      this.provisionSlave(slave.id);
    }
  };

  getSlaves = async () => this.clientState.slaves;

  getSocketIdx(index) {
    return this.io.sockets.connected[this.slaves[index].socketId];
  }

  getSocketFor(slave) {
    return this.io.sockets.connected[slave.socketId];
  }

  emitToPrimarySlave(event, ...args) {
    return this.emitToSlave(this.slaves[0], event, ...args);
  }

  async emitToSlave(slave, event, ...args) {
    return await new Promise(resolve =>
      this.getSocketFor(slave).emit(event, ...args, resolve)
    );
  }

  async emitToAllSlaves(event, ...args) {
    return (await Promise.all(
      this.slaves.map(async slave => {
        const result = await this.emitToSlave(slave, event, ...args);
        return { result, slaveId: slave.id };
      })
    )).filter(result => !!result);
  }

  registerSlave = async ({ id, startedAt }, socketId) => {
    this.setSlave(id, { socketId, startedAt, restarting: false });
  };

  deregisterSlave = async ({ id }) => {
    this.setClientState({
      slaves: this.clientState.slaves.filter(s => s.id !== id),
    });
  };

  runWorker = async i => {
    if (this.heroku) {
      const response = await this.heroku.post(
        `/apps/${process.env.HEROKU_APP_NAME}/dynos`,
        {
          body: {
            attach: false,
            command: 'worker',
            size: 'standard-2X',
            type: 'run',
          },
        }
      );
      this.workers[response.name] = response;
      return response;
    } else {
      this.provisionSlave(`worker.${i}`);
    }
  };
}
