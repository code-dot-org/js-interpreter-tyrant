import {ServerEvents, ClientEvents} from '../constants';
import VersionManager, {Repos} from './VersionManager';
import Tyrant from '@code-dot-org/js-interpreter-tyrant/dist/Tyrant';

export default class SocketAPI {
  handlers = {
    [ServerEvents.EXECUTE]: () => {
      const args = [
        '--root',
        this.versionManager.getLocalRepoPath(Repos.CODE_DOT_ORG, 'tyrant'),
        '--run',
        '--noExit',
        '--diff',
        '--progress',
        '--hostPath',
        this.versionManager.getLocalRepoPath(Repos.CODE_DOT_ORG, 'bin/run.js'),
        this.versionManager.getLocalRepoPath(
          Repos.CODE_DOT_ORG,
          'tyrant/test262/test/built-ins/isNaN/*.js'
        ),
      ];
      console.log('running tyrant with', args.join(' '));
      new Tyrant(args).setEventCallback(this.onTyrantEvent).execute();
    },
    [ServerEvents.UPDATE_VERSIONS]: async callback => {
      const versions = await this.versionManager.update();
      callback(versions);
    },
    [ServerEvents.SELECT_VERSION]: async (version, callback) => {
      callback(await this.versionManager.selectVersion(version));
    },
  };

  constructor(socket) {
    this.socket = socket;
    this.versionManager = new VersionManager({socket});
    Object.values(ServerEvents).forEach(eventName => {
      socket.on(eventName, this.getEventHandler(eventName));
    });
  }

  getEventHandler(eventName) {
    return (...args) => {
      if (this.handlers[eventName]) {
        return this.handlers[eventName](...args);
      } else {
        return {error: 'no such event'};
      }
    };
  }

  eventId = 1;

  onTyrantEvent = (eventName, data) =>
    this.socket.emit(ClientEvents.TYRANT_EVENT, {
      timestamp: new Date().getTime(),
      eventName,
      eventId: this.eventId++,
      data,
    });
}
