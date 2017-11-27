import Connection from '../client/Connection';

import SlaveVersionManager from './SlaveVersionManager';
import SlaveRunner from './SlaveRunner';

export default class Slave {
  constructor(socket, { id, master }) {
    this.id = id;
    this.master = master;
    this.socket = socket;
    this.versionManager = new SlaveVersionManager(socket, this.id);
    this.runner = new SlaveRunner(
      socket,
      this.id,
      this.versionManager,
      this.master
    );
    this.runner.listenTo(socket);
    this.versionManager.listenTo(socket);
    console.log('registering slave', this.id, 'with master');

    socket.on('Slave.kill', this.deregisterAndKill);
    process.on('SIGINT', this.deregisterAndKill);
    process.on('SIGTERM', this.deregisterAndKill);
    process.on('SIGHUP', this.deregisterAndKill);
  }

  start = async () => {
    try {
      await Connection.SlaveManager.registerSlave({
        id: this.id,
        startedAt: new Date().getTime(),
      });
      this.runner.start();
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  };

  deregisterAndKill = async () => {
    console.log('deregistering', this.id);
    await Connection.SlaveManager.deregisterSlave({ id: this.id });
    process.exit(1);
  };
}
