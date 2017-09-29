import MasterVersionManager from './MasterVersionManager';
import {EventNames} from './RPCInterface';
import SlaveManager from './SlaveManager';
import MasterRunner from './MasterRunner';
import {ClientEvents} from '../constants';

export default class SocketAPI {
  handlers = {
    getEventNames: callback => {
      callback(EventNames);
    },
  };

  constructor(io) {
    this.io = io;
    this.sockets = {};
    this.backendManager = new SlaveManager(this.io);
    this.versionManager = new MasterVersionManager(
      this.io,
      this.backendManager
    );
    this.masterRunner = new MasterRunner(this.io, this.backendManager);

    this.io.on('connection', this.onConnection);
    if (!this.backendManager.heroku) {
      // running locally. Go ahead and start up a slave
      this.backendManager.setConfig({numBackends: 1});
    }
  }

  getEventHandler = eventName => (...args) => this.handlers[eventName](...args);

  onConnection = socket => {
    this.sockets[socket.id] = socket;
    this.backendManager.listenTo(socket);
    this.versionManager.listenTo(socket);
    this.masterRunner.listenTo(socket);
    Object.keys(this.handlers).forEach(eventName => {
      socket.on(eventName, this.getEventHandler(eventName));
    });
    if (socket.handshake.query.type === 'backend') {
      socket.join('backends');
      Object.keys(ClientEvents).forEach(clientEvent =>
        socket.on(clientEvent, (...args) =>
          socket.broadcast.to('clients').emit(clientEvent, ...args)
        )
      );
    } else {
      socket.join('clients');
    }
  };
}
