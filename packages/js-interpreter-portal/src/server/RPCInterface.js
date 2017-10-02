export const EventNames = [];
export const ClassNames = [];

export default function RPCInterface({clientStateChangeEvent, type} = {}) {
  return cls => {
    if (!ClassNames.includes(cls.name)) {
      ClassNames.push(cls.name);
    }
    if (!clientStateChangeEvent) {
      clientStateChangeEvent = `${cls.name}.STATE_CHANGE`;
    }
    if (!type) {
      type = 'slave';
    }
    return class WrappedClass extends cls {
      setClientState(stateUpdates) {
        if (!this.clientState) {
          throw new Error(
            'You must specify a clientState object during construction if you want to set client state'
          );
        }
        let emitter;
        if (type === 'slave') {
          if (!this.socket) {
            throw new Error(
              'You must store the socket if you want to set client state'
            );
          }
          emitter = this.socket;
        } else if (type === 'master') {
          if (!this.io) {
            throw new Error(
              'An RPCInterface with type=master must have a this.io on it'
            );
          }
          emitter = this.io.to('clients');
        } else {
          throw new Error(
            `Unrecognized RPCInterface type "${type}". Use either "slave" or "master"`
          );
        }
        this.clientState = {...this.clientState, ...stateUpdates};
        emitter.emit(clientStateChangeEvent, this.clientState);
      }

      getClientState = async () => this.clientState;

      listenTo(socket) {
        Object.keys(this)
          .filter(
            key => !key.startsWith('_') && typeof this[key] === 'function'
          )
          .forEach(key => {
            const eventName = `${cls.name}.${key}`;
            console.log('listening for', eventName, 'from', socket.id);
            socket.on(
              eventName,
              async (data, callback) =>
                await this.__handler(socket.id, key, data, callback)
            );
            if (!EventNames.includes(eventName)) {
              EventNames.push(eventName);
            }
          });
      }

      async __handler(socketId, key, data, callback) {
        if (typeof data === 'function') {
          callback = data;
          data = null;
        }
        if (!key.startsWith('_') && typeof this[key] === 'function') {
          const result = await this[key](data, socketId);
          if (callback) {
            callback(result);
          }
        } else {
          console.warn('no handler for', key);
        }
      }
    };
  };
}
