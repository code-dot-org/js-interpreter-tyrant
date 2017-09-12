import {ServerEvents, ClientEvents} from '../constants';
import Tyrant from '@code-dot-org/js-interpreter-tyrant/dist/Tyrant';

export default class SocketAPI {
  handlers = {
    [ServerEvents.EXECUTE]: () => {
      new Tyrant([
        '--root',
        '../../../js-interpreter/tyrant',
        '--run',
        '--noExit',
        '--diff',
        '--progress',
        '--threads',
        '1',
        '../../../js-interpreter/tyrant/test262/test/built-ins/isNaN/*.js',
      ])
        .setEventCallback(this.onTyrantEvent)
        .execute();
    },
  };

  constructor(socket) {
    this.socket = socket;
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
