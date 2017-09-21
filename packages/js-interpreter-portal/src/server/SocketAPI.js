import {ClientEvents} from '../constants';
import VersionManager, {Repos} from './VersionManager';
import Tyrant from '@code-dot-org/js-interpreter-tyrant/dist/Tyrant';
import RPCInterface, {EventNames} from './RPCInterface';

@RPCInterface
class Runner {
  eventId = 1;

  constructor(socket, versionManager) {
    this.socket = socket;
    this.versionManager = versionManager;
  }

  _onTyrantEvent = (eventName, data) =>
    this.socket.emit(ClientEvents.TYRANT_EVENT, {
      timestamp: new Date().getTime(),
      eventName,
      eventId: this.eventId++,
      data,
    });

  execute = async () => {
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
    new Tyrant(args).setEventCallback(this._onTyrantEvent).execute();
  };
}

export default class SocketAPI {
  handlers = {
    getEventNames: callback => {
      callback(EventNames);
    },
  };

  constructor(socket) {
    this.socket = socket;
    this.versionManager = new VersionManager(socket);
    this.runner = new Runner(socket, this.versionManager);
    Object.keys(this.handlers).forEach(eventName => {
      socket.on(eventName, this.getEventHandler(eventName));
    });
  }

  getEventHandler = eventName => (...args) => this.handlers[eventName](...args);
}
