try {
  require('babel-polyfill');
} catch (e) {
  // meh.... it must have already been imported.
}
require('./integration-server');
