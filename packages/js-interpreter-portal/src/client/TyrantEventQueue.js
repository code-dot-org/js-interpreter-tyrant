import EventEmitter from 'events';
import {Events} from '@code-dot-org/js-interpreter-tyrant/dist/constants';
import moment from 'moment-mini';
import getConnection from './getConnection';
import {ClientEvents} from '../constants';

export {Events};

class TyrantEventQueue extends EventEmitter {
  queue = [];
  byEventName = {};

  constructor() {
    super();
    if (process.env.IS_CLIENT) {
      getConnection().on(ClientEvents.TYRANT_EVENT, event => {
        const {eventName} = event;
        if (!this.byEventName[eventName]) {
          this.byEventName[eventName] = [];
        }
        event = {
          ...event,
          eventName,
          timestamp: moment(new Date(event.timestamp)),
        };
        this.queue.push(event);
        this.byEventName[eventName].push(event);
        this.emit('any', event);
        this.emit(eventName, event);
      });
    }
  }

  getVersion(eventName) {
    if (Array.isArray(eventName)) {
      return eventName.map(en => this.getVersion(en)).join('.');
    }
    const events = this.getEvents(eventName);
    if (!events.length) {
      return 0;
    }
    return events[events.length - 1].eventId;
  }

  getEvents(eventName) {
    if (eventName) {
      return this.byEventName[eventName] || [];
    }
    return this.queue;
  }

  getLast(eventName) {
    const events = this.getEvents(eventName);
    return events[events.length - 1];
  }
}

const INSTANCE = new TyrantEventQueue();
export default INSTANCE;
