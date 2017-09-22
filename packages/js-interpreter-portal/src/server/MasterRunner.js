import RPCInterface from './RPCInterface';

@RPCInterface
export default class MasterRunner {
  constructor(io, backendManager) {
    this.io = io;
    this.backendManager = backendManager;
  }

  execute = async () => {
    this.backendManager.backends.forEach(({socketId}, splitIndex, backends) => {
      this.io.to(socketId).emit('SlaveRunner.execute', {
        splitIndex,
        splitInto: backends.length,
      });
    });
  };
}
