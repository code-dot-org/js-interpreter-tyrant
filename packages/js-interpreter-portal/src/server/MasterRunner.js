import { Events } from '@code-dot-org/js-interpreter-tyrant/dist/constants';
import Tyrant from '@code-dot-org/js-interpreter-tyrant/dist/Tyrant';
import { Repos } from './MasterVersionManager';
import { shortTestName, fullTestName, objectToArgs } from '../util';

import RPCInterface from './RPCInterface';
import SlaveRunner from '../slave/SlaveRunner';

@RPCInterface({ type: 'master' })
export default class MasterRunner {
  static SlaveClass = SlaveRunner;
  latestResults = [];
  testQueue = [];
  testsInProgress = [];
  testsCompleted = [];
  clientState = {
    running: false,
    numTests: 0,
    numTestsInQueue: 0,
    numTestsInProgress: 0,
    numTestsCompleted: 0,
  };

  constructor(io, slaveManager, versionManager) {
    this.versionManager = versionManager;
  }

  getSavedResults = () => this.getTyrant().getSavedResults();

  getNewDiffResults = () => this.testsCompleted;

  saveResults = async () => {
    const tyrant = this.getTyrant();
    tyrant.saveResults(this.testsCompleted);
    const regressions = this.testsCompleted.filter(t => t.isRegression);
    const fixes = this.testsCompleted.filter(t => t.isFix);
    const newTests = this.testsCompleted.filter(t => t.isNew);
    const getTestListStr = testList =>
      testList.map(test => shortTestName(test.file)).join('\n');
    this.versionManager.commitFile(tyrant.argv.savedResults, [
      'Update saved results',
      [`${regressions.length} regressions:`, getTestListStr(regressions)].join(
        '\n'
      ),
      [`${fixes.length} fixes:`, getTestListStr(fixes)].join('\n'),
      [`${newTests.length} new tests:`, getTestListStr(newTests)].join('\n'),
    ]);
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

  updateClientState() {
    const minutesPerTest =
      (new Date().getTime() - this.clientState.startTime) /
      1000 /
      60 /
      this.testsCompleted.length;
    this.setClientState({
      running: this.testQueue.length + this.testsInProgress.length > 0,
      numTestsInQueue: this.testQueue.length,
      numTestsInProgress: this.testsInProgress.length,
      numTestsCompleted: this.testsCompleted.length,
      minutesLeft:
        (this.testsInProgress.length + this.testQueue.length) * minutesPerTest,
    });
  }

  getNextTests = async () => {
    const tests = [];
    if (this.testQueue.length > 0) {
      for (let i = 0; i < 10 && this.testQueue.length > 0; i++) {
        const nextTest = this.testQueue.pop();
        this.testsInProgress.push(nextTest);
        tests.push(nextTest);
      }
    } else if (this.testsInProgress.length > 0) {
      // we're done, start giving more slaves a chance at these last tests.
      for (let i = 0; i < 10 && i < this.testsInProgress.length; i++) {
        tests.push(this.testsInProgress[i]);
      }
    } else {
      // everything is really really done, kill the slaves if they are not dead yet...
      this.slaveManager.clientState.slaves.forEach(({ id }) => {
        this.slaveManager.destroySlave(id);
      });
    }
    this.updateClientState();
    return { tests, ...this.clientState };
  };

  receiveTyrantEvents = async events => {
    events.forEach(event => {
      if (event.eventName === Events.TICK) {
        event.data.test.file = fullTestName(
          shortTestName(event.data.test.file)
        );
        this.testsCompleted.push(event.data.test);
        this.testsInProgress = this.testsInProgress.filter(
          t => shortTestName(t) !== shortTestName(event.data.test.file)
        );
      } else if (event.eventName === Events.RERUNNING_TESTS) {
        const tests = event.data.files.map(f => fullTestName(shortTestName(f)));
        this.testsInProgress = this.testsInProgress.concat(tests);
        this.testsCompleted = this.testsCompleted.filter(
          t => !tests.includes(fullTestName(shortTestName(t.file)))
        );
      }
    });
    this.updateClientState();
  };

  getResults = async () => {
    return this.testsCompleted.filter(
      test => test.isFix || test.isNew || test.isRegression
    );
  };

  execute = async ({ tests, numThreads, numSlaves, sha, rerun }) => {
    console.log('Executing from MasterRunner with', {
      tests,
      numThreads,
      numSlaves,
      sha,
      rerun,
    });
    this.setClientState({
      startTime: new Date().getTime(),
      running: true,
      sha,
      numSlaves,
      numThreads,
    });
    const tyrant = this.getTyrant(
      {},
      tests
        ? tests.map(path =>
            this.versionManager.getLocalRepoPath(Repos.CODE_DOT_ORG, path)
          )
        : []
    );
    this.testQueue = await tyrant.getTestFiles();
    this.testQueue = this.testQueue
      .slice(0)
      .map(t => fullTestName(shortTestName(t)));
    this.setClientState({ numTests: this.testQueue.length * 2 });
    for (let i = 0; i < numSlaves; i++) {
      this.slaveManager.runWorker(i);
    }
  };
}
