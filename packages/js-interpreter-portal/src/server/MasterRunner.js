import RPCInterface from './RPCInterface';
import SlaveRunner from '../slave/SlaveRunner';

@RPCInterface({type: 'master'})
export default class MasterRunner {
  static SlaveClass = SlaveRunner;

  getSavedResults = () =>
    this.slaveManager.emitToPrimarySlave('SlaveRunner.getSavedResults');

  getNewResults = async () =>
    this.slaveManager.emitToAllSlaves('SlaveRunner.getNewResults');

  saveResults = async () => {
    await this.slaveManager.emitToAllSlaves('SlaveRunner.saveResults');
  };

  kill = async () => {
    await Promise.all(
      this.slaveManager.slaves.map(this.slaveManager.restartSlave)
    );
  };

  execute = async ({tests}) => {
    this.slaveManager.slaves.forEach((slave, splitIndex, slaves) => {
      this.slaveManager.getSocketFor(slave).emit('SlaveRunner.execute', {
        splitIndex,
        splitInto: slaves.length,
        tests,
      });
    });
  };
}
