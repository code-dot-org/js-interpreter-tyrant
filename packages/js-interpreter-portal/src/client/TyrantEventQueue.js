import throttle from 'lodash.throttle';
import EventEmitter from 'events';
import {Events} from '@code-dot-org/js-interpreter-tyrant/dist/constants';
import moment from 'moment-mini';
import Connection from './Connection';
import {ClientEvents} from '../constants';

export {Events};

class TyrantEventQueue extends EventEmitter {
  queue = [];
  byEventName = {};

  processTyrantEventsQueue = [];
  processTyrantEvents = throttle(() => {
    const multiEmit = [];
    this.processTyrantEventsQueue.forEach(events =>
      events.forEach(event => {
        const {eventName} = event;
        if (!this.byEventName[eventName]) {
          this.byEventName[eventName] = [];
        }
        event = {
          ...event,
          eventName,
          timestamp: moment(new Date(event.timestamp)),
        };
        multiEmit.push(event);
        if (this.eventsToTrack.includes(eventName)) {
          this.queue.push(event);
          this.byEventName[eventName].push(event);
        }
        this.emit('any', event);
        this.emit(eventName, event);
      })
    );
    this.processTyrantEventsQueue = [];
    this.emit('multi', multiEmit);
  }, 500);

  init(eventsToTrack = []) {
    this.eventsToTrack = eventsToTrack;
    if (process.env.IS_CLIENT) {
      Connection.on(ClientEvents.TYRANT_EVENT, events => {
        this.processTyrantEventsQueue.push(events);
        this.processTyrantEvents();
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

export default new TyrantEventQueue();
