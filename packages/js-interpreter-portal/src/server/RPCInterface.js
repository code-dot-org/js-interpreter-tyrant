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

    class WrappedMasterClass extends cls {
      constructor(io, slaveManager, ...args) {
        super(io, slaveManager, ...args);
        this.io = io;
        this.slaveManager = slaveManager;
        this.clientState = this.clientState || {};
      }
      setClientState(stateUpdates) {
        this.clientState = {...this.clientState, ...stateUpdates};
        this.io.to('clients').emit(clientStateChangeEvent, this.clientState);
      }
      getClientState = async () => this.clientState;
    }

    class WrappedSlaveClass extends cls {
      constructor(socket, slaveId, ...args) {
        super(...args);
        this.socket = socket;
        this.slaveId = slaveId;
        this.clientState = this.clientState || {};
      }

      setClientState(stateUpdates) {
        this.clientState = {
          ...this.clientState,
          ...stateUpdates,
        };
        this.socket.emit(clientStateChangeEvent, {
          ...this.clientState,
          slaveId: this.slaveId,
        });
      }

      getClientState = async () => ({
        ...this.clientState,
        slaveId: this.slaveId,
      });
    }

    return class WrappedClass extends (type === 'slave'
      ? WrappedSlaveClass
      : WrappedMasterClass) {
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
