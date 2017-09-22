import {ClientEvents} from '../constants';
import {Repos} from './SlaveVersionManager';
import Tyrant from '@code-dot-org/js-interpreter-tyrant/dist/Tyrant';
import RPCInterface from '../server/RPCInterface';
import {objectToArgs} from '../util';

@RPCInterface
export default class SlaveRunner {
  eventId = 1;

  constructor(socket, versionManager) {
    this.socket = socket;
    socket.on('Runner.execute', () => console.log('HEOY'));
    this.versionManager = versionManager;
  }

  _onTyrantEvent = (backendId, eventName, data) =>
    this.socket.emit(ClientEvents.TYRANT_EVENT, {
      timestamp: new Date().getTime(),
      eventName,
      eventId: this.eventId++,
      backendId,
      data,
    });

  execute = async ({splitIndex, splitInto}) => {
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
        threads: 1,
        hostPath: this.versionManager.getLocalRepoPath(
          Repos.CODE_DOT_ORG,
          'bin/run.js'
        ),
      },
      ['isNaN', 'NaN', 'Number'].map(dir =>
        this.versionManager.getLocalRepoPath(
          Repos.CODE_DOT_ORG,
          `tyrant/test262/test/built-ins/${dir}/*.js`
        )
      )
    );
    console.log('running tyrant with', args.join(' '));
    new Tyrant(args)
      .setEventCallback((...args) => this._onTyrantEvent(splitIndex, ...args))
      .execute();
  };
}
