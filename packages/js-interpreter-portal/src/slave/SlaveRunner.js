import throttle from 'lodash.throttle';
import { ClientEvents } from '../constants';
import { Repos } from './SlaveVersionManager';
import Tyrant from '@code-dot-org/js-interpreter-tyrant/dist/Tyrant';
import { Events } from '@code-dot-org/js-interpreter-tyrant/dist/constants';
import RPCInterface from '../server/RPCInterface';
import { objectToArgs } from '../util';
import { rootLock } from './locks';

const MIN_MS_BETWEEN_EMIT = 1000;

@RPCInterface()
export default class SlaveRunner {
  eventId = 1;
  clientState = {
    numThreads: 8,
    forwardAllTyrantEvents: false,
  };

  emitQueue = [];

  constructor(versionManager) {
    this.versionManager = versionManager;
  }

  _onTyrantEvent = (eventName, data) => {
    const timestamp = new Date().getTime();
    this.emitQueue.push({
      timestamp,
      eventName,
      eventId: this.eventId++,
      slaveId: this.slaveId,
      data,
    });
    this._emitQueuedEvents();
  };

  _emitQueuedEvents = throttle(() => {
    this.socket.emit(ClientEvents.TYRANT_EVENT, this.emitQueue);
    this.emitQueue = [];
  }, MIN_MS_BETWEEN_EMIT);

  setNumThreads = async ({ numThreads }) => {
    this.setClientState({ numThreads });
  };

  setForwardAllTyrantEvents = async ({ forwardAllTyrantEvents }) => {
    this.setClientState({ forwardAllTyrantEvents });
  };

  saveResults = async () => {
    await this.getTyrant({ save: true }).execute();
  };

  getSavedResults = async () => {
    return this.getTyrant().getSavedResults();
  };

  getNewResults = async () => {
    const tyrant = this.getTyrant();
    return tyrant
      .getNewResults()
      .map(test => ({ ...test, ...tyrant.getTestDiff(test) }))
      .filter(
        ({ isNew, isFix, isRegression }) => isNew || isFix || isRegression
      );
  };

  kill = async () => {
    console.log('Killing slave process.');
    this.setClientState({ running: false });
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

  execute = async ({ splitIndex, splitInto, tests, rerun }) => {
    let newResults;
    await rootLock.waitForLock(async () => {
      console.log('executing tests', tests);
      const tyrant = this.getTyrant(
        {
          splitIndex,
          splitInto,
          rerun,
          retries: 3,
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
        .setEventCallback((...args) => {
          if (this.clientState.forwardAllTyrantEvents) {
            this._onTyrantEvent(...args);
          }
        })
        .on(Events.STARTED_EXECUTION, () =>
          this.setClientState({ running: true })
        )
        .on(Events.STARTED_RUNNING, ({ numTests }) =>
          this.setClientState({ completed: 0, numTests })
        )
        .on(Events.TICK, data => {
          const { minutes, test: { isFix, isRegression, isNew } } = data;
          if (isFix || isRegression || isNew) {
            this._onTyrantEvent(Events.TICK, data);
          }
          this.setClientState({
            completed: this.clientState.completed + 1,
            minutes,
          });
        })
        .on(Events.FINISHED_EXECUTION, () =>
          this.setClientState({ running: false })
        )
        .on(Events.RERUNNING_TESTS, ({ files, retriesLeft }) => {
          this._onTyrantEvent(Events.RERUNNING_TESTS, {
            files: Array.from(files),
            retriesLeft,
          });
        });
      await tyrant.execute();
      newResults = tyrant.getNewResults();
    });
    return newResults;
  };
}
