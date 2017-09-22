import Connection from '../client/Connection';

import SlaveVersionManager from './SlaveVersionManager';
import SlaveRunner from './SlaveRunner';

export default class Backend {
  constructor(socket, {id, master}) {
    this.id = id;
    this.master = master;
    this.socket = socket;
    this.versionManager = new SlaveVersionManager(socket, this.id);
    this.runner = new SlaveRunner(socket, this.versionManager);
    this.runner.listenTo(socket);
    this.versionManager.listenTo(socket);
    console.log('registering backend', this.id, 'with master');
    Connection.SlaveManager.registerBackend({id: this.id});
    this.versionManager.update();
  }
}
