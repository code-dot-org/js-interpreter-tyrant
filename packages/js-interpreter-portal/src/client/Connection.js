import throttle from 'lodash.throttle';
import SocketIOClient from 'socket.io-client';
import {EventNames} from '../server/RPCInterface';

const CLIENT_STATE_THROTTLE = 100;

class Connection {
  on(...args) {
    return this.conn.on(...args);
  }

  onReconnectAttempt = attemptNumber => {
    console.log('Attempting to reconnect to server. Attempt #', attemptNumber);
  };

  initClient({url, callback}) {
    this.conn = SocketIOClient.connect(url, {reconnect: true});
    this.conn.on('reconnect_attempt', this.onReconnectAttempt);
    this.conn.emit('getClassNames', classNames => {
      classNames.forEach(cls => {
        if (!this[cls]) {
          this[cls] = {};
        }
        this[cls].onClientStateChange = func =>
          this.on(`${cls}.STATE_CHANGE`, throttle(func, CLIENT_STATE_THROTTLE));
      });
    });
    this.conn.emit('getEventNames', eventNames => {
      eventNames.forEach(eventName => {
        const [cls, func] = eventName.split('.');
        if (!this[cls]) {
          this[cls] = {};
        }
        this[cls][func] = async (...args) => {
          return await new Promise(resolve => {
            this.conn.emit(eventName, ...args, (...response) => {
              resolve(...response);
            });
          });
        };
      });
      callback(this.conn);
    });
  }

  initServer() {
    EventNames.forEach(eventName => {
      const [cls, func] = eventName.split('.');
      if (!this[cls]) {
        this[cls] = {};
      }
      this[cls][func] = () => {
        throw new Error(
          `${eventName} is supposed to run on the client... not the server`
        );
      };
    });
  }
}

export default new Connection();
