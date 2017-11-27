import fs from 'fs';
import request from 'request';
import path from 'path';
import throttle from 'lodash.throttle';
import { ClientEvents } from '../constants';
import { REPO_ROOT, Repos } from './SlaveVersionManager';
import ChildProcess from 'child_process';
import { promisify } from 'util';
import Tyrant from '@code-dot-org/js-interpreter-tyrant/dist/Tyrant';
import { Events } from '@code-dot-org/js-interpreter-tyrant/dist/constants';
import RPCInterface from '../server/RPCInterface';
import Connection from '../client/Connection';
import { objectToArgs } from '../util';
import { rootLock } from './locks';

const exec = promisify(ChildProcess.exec);

const MIN_MS_BETWEEN_EMIT = 1000;

@RPCInterface()
export default class SlaveRunner {
  eventId = 1;
  clientState = {
    numThreads: 8,
    forwardAllTyrantEvents: false,
  };

  emitQueue = [];

  constructor(versionManager, masterServerUrl) {
    this.versionManager = versionManager;
    this.masterServerUrl = masterServerUrl;
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

  saveResults = async results => {
    this.getTyrant().saveResults(results);
  };

  getSavedResults = async () => {
    return this.getTyrant().getSavedResults();
  };

  getNewResults = async () => {
    return this.getTyrant.getNewResults();
  };

  getNewDiffResults = async () => {
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
        diff: true,
        ...args,
      },
      positional
    );
    return new Tyrant(cliArgs);
  }

  start = async () => {
    let nextTests = await Connection.MasterRunner.getNextTests();
    const repoPath = this.versionManager.getLocalRepoPath(Repos.CODE_DOT_ORG);
    if (!fs.existsSync(repoPath)) {
      console.log('downloading zip archive');

      const zipPath = path.resolve(
        REPO_ROOT,
        `${this.slaveId}-${nextTests.sha}.zip`
      );

      let cmds = [
        `curl ${this.masterServerUrl}/gitzips/${nextTests.sha} -o ${zipPath}`,
        `mkdir -p ${repoPath}`,
        `unzip -q ${zipPath} -d ${repoPath}`,
      ];
      for (const cmd of cmds) {
        console.log(cmd);
        await exec(cmd);
      }
      cmds = [
        'yarn',
        'curl https://codeload.github.com/tc39/test262/zip/89160ff5b7cb6d5f8938b4756829100110a14d5f -o test262.zip',
        'unzip -q test262.zip',
        'rm -rf tyrant/test262',
        'mv test262-89160ff5b7cb6d5f8938b4756829100110a14d5f tyrant/test262',
      ];
      for (const cmd of cmds) {
        console.log(cmd);
        await exec(cmd, { cwd: repoPath });
      }
    }

    while (nextTests.tests.length > 0) {
      const { tests, sha, numThreads } = nextTests;
      console.log('running these tests:', tests);
      await this.execute({ tests, numThreads, sha });

      nextTests = await Connection.MasterRunner.getNextTests();
      if (nextTests.sha !== sha) {
        throw new Error('Did not expect commit sha to change');
      }
    }
    console.log('No more tests left. Exiting.');
    process.exit(0);
  };

  execute = async ({ splitIndex, splitInto, tests, rerun, numThreads }) => {
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
          progress: true,
          threads: numThreads,
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
          this.setClientState({
            running: true,
            eventTrigger: 'STARTED_EXECUTION',
          })
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
        .on(Events.FINISHED_EXECUTION, () => {
          this.setClientState({
            running: false,
            eventTrigger: 'FINISHED_EXECUTION',
          });
        })
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
