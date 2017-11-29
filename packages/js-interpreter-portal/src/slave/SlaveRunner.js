import fs from 'fs';
import throttle from 'lodash.throttle';
import { ClientEvents } from '../constants';
import { Repos } from './SlaveVersionManager';
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
    Connection.MasterRunner.receiveTyrantEvents(this.emitQueue);
    this.socket.emit(ClientEvents.TYRANT_EVENT, this.emitQueue);
    this.emitQueue = [];
  }, MIN_MS_BETWEEN_EMIT);

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
    this.setClientState({ running: true });
    let nextTests = await Connection.MasterRunner.getNextTests();
    const repoPath = this.versionManager.getLocalRepoPath(Repos.CODE_DOT_ORG);
    if (!fs.existsSync(repoPath)) {
      console.log('downloading zip archive');

      const zipPath = `${this.slaveId}-${nextTests.sha}.zip`;

      let cmds = [
        `curl ${this.masterServerUrl}/gitzips/${nextTests.sha} -o ${
          zipPath
        } -v`,
        `mkdir -p ${repoPath}`,
        `unzip -q ${zipPath} -d ${repoPath}`,
      ];
      for (const cmd of cmds) {
        console.log(cmd);
        await exec(cmd);
      }
      cmds = [
        'yarn',
        'curl https://codeload.github.com/tc39/test262/zip/89160ff5b7cb6d5f8938b4756829100110a14d5f -o test262.zip -v',
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
      console.log(this.slaveId, 'running', tests.length, 'tests');
      await this.execute({ tests, numThreads, sha });

      nextTests = await Connection.MasterRunner.getNextTests();
      if (nextTests.sha !== sha) {
        this.setClientState({ running: false });
        throw new Error('Did not expect commit sha to change');
      }
    }
    console.log('No more tests left. Exiting in a sec.');
    this.setClientState({ running: false });
    setTimeout(() => process.exit(0), 3000);
  };

  execute = async ({
    splitIndex,
    splitInto,
    tests,
    rerun,
    retries,
    numThreads,
  }) => {
    let newResults;
    await rootLock.waitForLock(async () => {
      const tyrant = this.getTyrant(
        {
          splitIndex,
          splitInto,
          rerun,
          retries,
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
        .on(Events.STARTED_EXECUTION, () => {})
        .on(Events.STARTED_RUNNING, ({ numTests }) =>
          this.setClientState({ completed: 0, numTests })
        )
        .on(Events.TICK, data => {
          //const { minutes, test: { isFix, isRegression, isNew } } = data;
          //          if (isFix || isRegression || isNew) {
          this._onTyrantEvent(Events.TICK, data);
          //          }
        })
        .on(Events.FINISHED_EXECUTION, () => {
          tyrant.removeAllListeners();
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
