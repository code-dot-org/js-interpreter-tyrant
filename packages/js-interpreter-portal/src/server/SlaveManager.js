import child_process from 'child_process';
import RPCInterface from './RPCInterface';
import Heroku from 'heroku-client';
import sortBy from 'lodash.sortby';

@RPCInterface({ type: 'master' })
export default class SlaveManager {
  clientState = {
    slaves: [],
    numThreads: 8,
    formation: [],
    numRequestedSlaves: 0,
  };

  childProcesses = {};

  constructor(io) {
    this.io = io;
    if (process.env.HEROKU_API_TOKEN) {
      console.log('heroku api token present. Will use heroku for slaves');
      this.heroku = new Heroku({ token: process.env.HEROKU_API_TOKEN });
    }
    setInterval(this.updateFormation, 10000);
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

  destroySlave(id) {
    this.emitToSlave(this.getSlave(id), 'Slave.kill');
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

  updateFormation = async () => {
    let formation = [];
    if (this.heroku) {
      formation = await this.heroku.get(
        `/apps/${process.env.HEROKU_APP_NAME}/formation`
      );
    }
    this.setClientState({ formation });
  };

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

  setConfig = async ({ numSlaves, numThreads }) => {
    if (numSlaves !== undefined) {
      await this.setNumSlaves(numSlaves);
    }
    if (numThreads) {
      this.clientState.slaves.forEach(({ socketId }) => {
        this.io.to(socketId).emit('SlaveRunner.setNumThreads', { numThreads });
      });
      this.setClientState({ numThreads });
    }
  };

  setNumSlaves = async numSlaves => {
    this.setClientState({ numRequestedSlaves: numSlaves });
    if (this.heroku) {
      console.log(
        'sending patch request to',
        `/apps/${process.env.HEROKU_APP_NAME}/formation/worker`
      );
      if (numSlaves < this.clientState.slaves.length) {
        for (let i = this.clientState.slaves.length; i > numSlaves; i--) {
          this.destroySlave(this.clientState.slaves[i - 1].id);
        }
      }
      return await this.heroku.patch(
        `/apps/${process.env.HEROKU_APP_NAME}/formation/worker`,
        { body: { quantity: numSlaves } }
      );
    }
    if (numSlaves > this.clientState.slaves.length) {
      for (let i = this.clientState.slaves.length; i < numSlaves; i++) {
        this.provisionSlave(`worker.${i}`);
      }
    } else {
      for (let i = this.clientState.slaves.length; i > numSlaves; i--) {
        this.destroySlave(this.clientState.slaves[i - 1].id);
      }
    }
  };
}
