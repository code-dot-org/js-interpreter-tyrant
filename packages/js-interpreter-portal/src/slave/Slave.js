import Connection from '../client/Connection';

import SlaveVersionManager from './SlaveVersionManager';
import SlaveRunner from './SlaveRunner';

export default class Slave {
  constructor(socket, {id, master}) {
    this.id = id;
    this.master = master;
    this.socket = socket;
    this.versionManager = new SlaveVersionManager(socket, this.id);
    this.runner = new SlaveRunner(socket, this.versionManager);
    this.runner.listenTo(socket);
    this.versionManager.listenTo(socket);
    console.log('registering slave', this.id, 'with master');
    Connection.SlaveManager.registerSlave({id: this.id});
    this.versionManager.update();
  }
}
