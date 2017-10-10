import RPCInterface from './RPCInterface';
import SlaveRunner from '../slave/SlaveRunner';

@RPCInterface({type: 'master'})
export default class MasterRunner {
  static SlaveClass = SlaveRunner;

  getSavedResults = () =>
    this.slaveManager.emitPrimarySlave('SlaveRunner.getSavedResults');

  saveResults = async results => {
    await this.slaveManager.emitPrimarySlave(
      'SlaveRunner.saveResults',
      results
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
