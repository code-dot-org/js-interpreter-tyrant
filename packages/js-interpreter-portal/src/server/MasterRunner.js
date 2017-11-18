import RPCInterface from './RPCInterface';
import SlaveRunner from '../slave/SlaveRunner';

@RPCInterface({ type: 'master' })
export default class MasterRunner {
  static SlaveClass = SlaveRunner;
  latestResults = [];
  clientState = {
    running: false,
  };

  getSavedResults = () =>
    this.slaveManager.emitToPrimarySlave('SlaveRunner.getSavedResults');

  getNewDiffResults = () =>
    this.slaveManager.emitToAllSlaves('SlaveRunner.getNewDiffResults');

  saveResults = async () => {
    const allNewResults = await this.slaveManager.emitToAllSlaves(
      'SlaveRunner.getNewResults'
    );
    let combinedResults = [];
    allNewResults.forEach(
      ({ result }) => (combinedResults = [...combinedResults, ...result])
    );
    await this.slaveManager.emitToPrimarySlave(
      'SlaveRunner.saveResults',
      combinedResults
    );
    //    await this.slaveManager.emitToPrimarySlave('SlaveRunner.pushUpstream');
    this.slaveManager.emitToAllSlaves('SlaveVersionManager.update');
  };

  getSlaveStates = () =>
    this.slaveManager.emitToAllSlaves('SlaveRunner.getClientState');

  kill = async () => {
    await Promise.all(
      this.slaveManager.slaves.map(this.slaveManager.restartSlave)
    );
  };

  execute = async ({ tests, rerun }) => {
    this.latestResults = [];
    this.setClientState({ running: true });
    await Promise.all(
      this.slaveManager.slaves.map(
        (slave, splitIndex, slaves) =>
          new Promise(resolve => {
            this.slaveManager.getSocketFor(slave).emit(
              'SlaveRunner.execute',
              {
                splitIndex,
                splitInto: slaves.length,
                tests,
                rerun,
              },
              newResults => {
                this.latestResults = [...this.latestResults, ...newResults];
                resolve(newResults);
              }
            );
          })
      )
    );
    this.setClientState({ running: false });
  };
}
