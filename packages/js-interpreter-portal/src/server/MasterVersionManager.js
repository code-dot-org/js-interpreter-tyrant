import RPCInterface from './RPCInterface';

@RPCInterface
export default class MasterVersionManager {
  clientState = {
    lastLog: '',
    currentVersion: null,
    versions: [],
    updating: false,
  };

  constructor(io, backendManager) {
    this.io = io;
    this.backendManager = backendManager;
  }

  update = async () => {
    this.backendManager.backends.forEach(({socketId}) => {
      this.io.to(socketId).emit('SlaveVersionManager.update');
    });
  };

  selectVersion = async version => {
    this.backendManager.backends.forEach(({socketId}) => {
      this.io.to(socketId).emit('SlaveVersionManager.selectVersion', version);
    });
  };
}
