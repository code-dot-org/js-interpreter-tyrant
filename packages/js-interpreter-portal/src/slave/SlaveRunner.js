import {ClientEvents} from '../constants';
import {Repos} from './SlaveVersionManager';
import Tyrant from '@code-dot-org/js-interpreter-tyrant/dist/Tyrant';
import {Events} from '@code-dot-org/js-interpreter-tyrant/dist/constants';
import RPCInterface from '../server/RPCInterface';
import {objectToArgs} from '../util';

@RPCInterface()
export default class SlaveRunner {
  eventId = 1;
  numThreads = 1;

  constructor(socket, versionManager, slaveId) {
    this.socket = socket;
    this.versionManager = versionManager;
    this.slaveId = slaveId;
  }

  _onTyrantEvent = (eventName, data) =>
    this.socket.emit(ClientEvents.TYRANT_EVENT, {
      timestamp: new Date().getTime(),
      eventName,
      eventId: this.eventId++,
      slaveId: this.slaveId,
      data,
    });

  setNumThreads = async ({numThreads}) => {
    this.numThreads = numThreads;
  };

  saveResults = async results => {
    this.getTyrant().saveResults(results);
  };

  getSavedResults = async () => {
    return this.getTyrant().getSavedResults();
  };

  getNewResults = async () => {
    return this.getTyrant().getNewResults();
  };

  getTyrant({splitIndex, splitInto, tests} = {}) {
    const args = objectToArgs(
      {
        root: this.versionManager.getLocalRepoPath(
          Repos.CODE_DOT_ORG,
          'tyrant'
        ),
        splitInto,
        splitIndex,
        run: true,
        noExit: true,
        diff: true,
        progress: true,
        threads: this.numThreads,
        hostPath: this.versionManager.getLocalRepoPath(
          Repos.CODE_DOT_ORG,
          'bin/run.js'
        ),
      },
      tests
        ? tests.map(path =>
            this.versionManager.getLocalRepoPath(Repos.CODE_DOT_ORG, path)
          )
        : []
    );
    return new Tyrant(args);
  }

  execute = async ({splitIndex, splitInto, tests}) => {
    this.getTyrant({splitIndex, splitInto, tests})
      .setEventCallback((...args) => this._onTyrantEvent(...args))
      .execute();
  };
}
