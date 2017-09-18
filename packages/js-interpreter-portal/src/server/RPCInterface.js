export const EventNames = [];

export default function RPCInterface(cls) {
  return class Foo extends cls {
    constructor(socket, ...args) {
      super(socket, ...args);
      Object.keys(this)
        .filter(key => !key.startsWith('_') && typeof this[key] === 'function')
        .forEach(key => {
          const eventName = `${cls.name}.${key}`;
          console.log('listening for', eventName);
          socket.on(
            eventName,
            async (...args) => await this.__handler(key, ...args)
          );
          console.log('setting up', eventName);
          EventNames.push(eventName);
        });
    }

    async __handler(key, ...args) {
      if (!key.startsWith('_') && typeof this[key] === 'function') {
        const result = await this[key](...args);
        if (args.length > 0) {
          const callback = args[args.length - 1];
          if (typeof callback === 'function') {
            callback(result);
          }
        }
      } else {
        console.warn('no handler for', key);
      }
    }
  };
}
