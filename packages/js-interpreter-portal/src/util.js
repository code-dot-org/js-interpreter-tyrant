export function objectToArgs(obj = {}, positional = []) {
  const args = [];
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    const flag = '--' + key;
    if (typeof val === 'boolean') {
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

export function shortTestName(path) {
  return path.split('test262/test/')[1];
}
