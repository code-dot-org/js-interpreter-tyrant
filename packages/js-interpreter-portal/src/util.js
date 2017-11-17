export function objectToArgs(obj = {}, positional = []) {
  const args = [];
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    const flag = '--' + key;
    if (typeof val === 'boolean' || val === undefined) {
      if (val) {
        args.push(flag);
      }
    } else {
      args.push(flag);
      args.push('' + val);
    }
  });
  return [...args, ...positional];
}

/**
 * Returns just the part of the test file path that changes
 * from test to test. This is the minimal path to identify
 * any test file uniquely.
 */
export function shortTestName(path) {
  return path.split('test262/test/')[1];
}

export function fullTestName(path) {
  return 'tyrant/test262/test/' + path;
}

export class Lock {
  constructor(name) {
    this.name = name;
    this.lock = null;
  }

  async waitForLock(func) {
    while (this.lock) {
      await this.lock;
    }

    this.lock = func();
    if (!(this.lock instanceof Promise)) {
      throw new Error('withLock must be called with an async function');
    }
    await this.lock;
    this.lock = null;
  }
}
