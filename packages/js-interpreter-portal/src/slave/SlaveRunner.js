import {ClientEvents} from '../constants';
import {Repos} from './SlaveVersionManager';
import Tyrant from '@code-dot-org/js-interpreter-tyrant/dist/Tyrant';
import {Events} from '@code-dot-org/js-interpreter-tyrant/dist/constants';
import RPCInterface from '../server/RPCInterface';
import {objectToArgs} from '../util';

@RPCInterface()
export default class SlaveRunner {
  eventId = 1;
  clientState = {
    numThreads: 8,
  };

  constructor(versionManager) {
    this.versionManager = versionManager;
  }

  _onTyrantEvent = (eventName, data) => {
    this.socket.emit(ClientEvents.TYRANT_EVENT, {
      timestamp: new Date().getTime(),
      eventName,
      eventId: this.eventId++,
      slaveId: this.slaveId,
      data,
    });
  };

  setNumThreads = async ({numThreads}) => {
    this.setClientState({numThreads});
  };

  saveResults = async () => {
    await this.getTyrant({save: true}).execute();
  };

  getSavedResults = async () => {
    return this.getTyrant().getSavedResults();
  };

  getNewResults = async () => {
    const tyrant = this.getTyrant();
    return tyrant
      .getNewResults()
      .map(test => ({...test, ...tyrant.getTestDiff(test)}))
      .filter(({isNew, isFix, isRegression}) => isNew || isFix || isRegression);
  };

  kill = async () => {
    console.log('Killing slave process.');
    this.setClientState({running: false});
    await new Promise(resolve =>
      setTimeout(() => resolve(process.exit(1)), 1000)
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
        ...args,
      },
      positional
    );
    return new Tyrant(cliArgs);
  }

  execute = async ({splitIndex, splitInto, tests}) => {
    this.getTyrant(
      {
        splitIndex,
        splitInto,
        run: true,
        noExit: true,
        diff: true,
        progress: true,
        threads: this.clientState.numThreads,
      },
      tests
        ? tests.map(path =>
            this.versionManager.getLocalRepoPath(Repos.CODE_DOT_ORG, path)
          )
        : []
    )
      .setEventCallback((...args) => this._onTyrantEvent(...args))
      .on(Events.STARTED_EXECUTION, () => this.setClientState({running: true}))
      .on(Events.STARTED_RUNNING, ({numTests}) =>
        this.setClientState({completed: 0, numTests})
      )
      .on(Events.TICK, ({minutes}) =>
        this.setClientState({
          completed: this.clientState.completed + 1,
          minutes,
        })
      )
      .on(Events.FINISHED_EXECUTION, () =>
        this.setClientState({running: false})
      )
      .execute();
  };
}
