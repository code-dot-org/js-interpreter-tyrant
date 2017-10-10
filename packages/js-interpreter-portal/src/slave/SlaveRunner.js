import {ClientEvents} from '../constants';
import {Repos} from './SlaveVersionManager';
import Tyrant from '@code-dot-org/js-interpreter-tyrant/dist/Tyrant';
import RPCInterface from '../server/RPCInterface';
import {objectToArgs} from '../util';

@RPCInterface()
export default class SlaveRunner {
  eventId = 1;
  numThreads = 1;

  constructor(socket, versionManager) {
    this.socket = socket;
    this.versionManager = versionManager;
  }

  _onTyrantEvent = (slaveId, eventName, data) =>
    this.socket.emit(ClientEvents.TYRANT_EVENT, {
      timestamp: new Date().getTime(),
      eventName,
      eventId: this.eventId++,
      slaveId,
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
      //['String'].map(dir =>
      //  this.versionManager.getLocalRepoPath(
      //    Repos.CODE_DOT_ORG,
      //    `tyrant/test262/test/built-ins/${dir}/*.js`
      //  )
      //)
    );
    return new Tyrant(args);
  }

  execute = async ({splitIndex, splitInto, tests}) => {
    this.getTyrant({splitIndex, splitInto, tests})
      .setEventCallback((...args) => this._onTyrantEvent(splitIndex, ...args))
      .execute();
  };
}
