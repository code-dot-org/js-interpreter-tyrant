import MasterVersionManager from './MasterVersionManager';
import { EventNames, ClassNames } from './RPCInterface';
import SlaveManager from './SlaveManager';
import MasterRunner from './MasterRunner';
import { ClientEvents } from '../constants';

export default class SocketAPI {
  handlers = {
    getEventNames: callback => {
      callback(EventNames);
    },
    getClassNames: callback => {
      callback(ClassNames);
    },
  };

  constructor(io, app) {
    this.app = app;
    this.io = io;
    this.sockets = {};
    this.slaveManager = new SlaveManager(this.io);
    this.versionManager = new MasterVersionManager(this.io, this.slaveManager);
    this.masterRunner = new MasterRunner(
      this.io,
      this.slaveManager,
      this.versionManager
    );
    this.app.get('/gitzips/:sha', this.handleGitZipRequest);

    this.io.on('connection', this.onConnection);
    this.versionManager.update();
  }

  handleGitZipRequest = async (req, res) => {
    const filePath = await this.versionManager.getArchive(req.params.sha);
    res.sendFile(filePath);
  };

  getEventHandler = eventName => (...args) => this.handlers[eventName](...args);

  onConnection = socket => {
    this.sockets[socket.id] = socket;
    this.slaveManager.listenTo(socket);
    this.versionManager.listenTo(socket);
    this.masterRunner.listenTo(socket);
    Object.keys(this.handlers).forEach(eventName => {
      socket.on(eventName, this.getEventHandler(eventName));
    });
    if (socket.handshake.query.type === 'slave') {
      socket.join('slaves');
      Object.keys(ClientEvents)
        .concat(ClassNames.map(cls => `${cls}.STATE_CHANGE`))
        .forEach(clientEvent => {
          socket.on(clientEvent, (...args) => {
            socket.broadcast.to('clients').emit(clientEvent, ...args);
          });
        });
    } else {
      socket.join('clients');
    }
  };
}
