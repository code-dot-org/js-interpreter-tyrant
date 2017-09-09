import Tyrant from '@code-dot-org/js-interpreter-tyrant/dist/Tyrant';

export default async function execute(req, res) {
  new Tyrant([
    '--root',
    '../../../js-interpreter/tyrant',
    '--run',
    '../../../js-interpreter/tyrant/test262/test/built-ins/isNaN/*.js',
  ]).execute();
}
