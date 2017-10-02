import RPCInterface from './RPCInterface';
import SlaveRunner from '../slave/SlaveRunner';

@RPCInterface()
export default class MasterRunner {
  static SlaveClass = SlaveRunner;

  constructor(io, backendManager) {
    this.io = io;
    this.backendManager = backendManager;
  }

  getSavedResults = async () => {
    this.io
      .to(this.backendManager.backends[0].socketId)
      .emit('SlaveRunner.getSavedResults');
  };

  execute = async () => {
    this.backendManager.backends.forEach(({socketId}, splitIndex, backends) => {
      this.io.to(socketId).emit('SlaveRunner.execute', {
        splitIndex,
        splitInto: backends.length,
      });
    });
  };
}
