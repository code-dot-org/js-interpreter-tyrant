import Tyrant from '@code-dot-org/js-interpreter-tyrant/dist/Tyrant';
import { Repos } from './MasterVersionManager';
import { objectToArgs } from '../util';

import RPCInterface from './RPCInterface';
import SlaveRunner from '../slave/SlaveRunner';

@RPCInterface({ type: 'master' })
export default class MasterRunner {
  static SlaveClass = SlaveRunner;
  latestResults = [];
  testQueue = [];
  clientState = {
    running: false,
  };

  constructor(io, slaveManager, versionManager) {
    this.versionManager = versionManager;
  }

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

  getTyrant(args = {}, positional = []) {
    const cliArgs = objectToArgs(
      {
        root: this.versionManager.getLocalRepoPath(
          Repos.CODE_DOT_ORG,
          'tyrant'
        ),
        hostPath: this.versionManager.getLocalRepoPath(
          Repos.CODE_DOT_ORG,
          'bin/run.js'
        ),
        diff: true,
        ...args,
      },
      positional
    );
    return new Tyrant(cliArgs);
  }

  getNextTests = async () => {
    const tests = [];
    for (let i = 0; i < 10 && this.testQueue.length > 0; i++) {
      tests.push(this.testQueue.pop());
    }
    return { tests, ...this.clientState };
  };

  execute = async ({ tests, numThreads, numSlaves, sha, rerun }) => {
    console.log('Executing from MasterRunner with', {
      tests,
      numThreads,
      numSlaves,
      sha,
      rerun,
    });
    this.setClientState({ running: true, sha, numSlaves, numThreads });
    const tyrant = this.getTyrant(
      {},
      tests
        ? tests.map(path =>
            this.versionManager.getLocalRepoPath(Repos.CODE_DOT_ORG, path)
          )
        : []
    );
    this.testQueue = await tyrant.getTestFiles();
    console.log(this.testQueue.length, 'items in queue');
    await this.slaveManager.setNumSlaves(numSlaves);
    return;
    //    this.latestResults = [];
    //    await Promise.all(
    //      this.slaveManager.slaves.map(
    //        (slave, splitIndex, slaves) =>
    //          new Promise(resolve => {
    //            this.slaveManager.getSocketFor(slave).emit(
    //              'SlaveRunner.execute',
    //              {
    //                sha,
    //                numThreads,
    //                splitIndex,
    //                splitInto: slaves.length,
    //                tests,
    //                rerun,
    //              },
    //              newResults => {
    //                this.latestResults = [...this.latestResults, ...newResults];
    //                resolve(newResults);
    //              }
    //            );
    //          })
    //      )
    //    );
    //  this.setClientState({ running: false });
  };
}
