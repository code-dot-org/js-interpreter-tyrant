export const EventNames = [];

export default function RPCInterface(cls) {
  return class WrappedClass extends cls {
    listenTo(socket) {
      Object.keys(this)
        .filter(key => !key.startsWith('_') && typeof this[key] === 'function')
        .forEach(key => {
          const eventName = `${cls.name}.${key}`;
          console.log('listening for', eventName, 'from', socket.id);
          socket.on(
            eventName,
            async (data, callback) =>
              await this.__handler(socket.id, key, data, callback)
          );
          EventNames.push(eventName);
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
}
