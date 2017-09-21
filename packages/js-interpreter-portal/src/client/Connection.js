import io from 'socket.io-client';
import {EventNames} from '../server/RPCInterface';

class Connection {
  on(...args) {
    return this.conn.on(...args);
  }

  initClient(callback) {
    if (!process.env.IS_CLIENT) {
      throw new Error('initClient can only be called on the client...');
    }
    this.conn = io();
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
      callback();
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
