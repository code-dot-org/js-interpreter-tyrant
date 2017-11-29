import path from 'path';
import RPCInterface from '../server/RPCInterface';

export const REPO_ROOT = '/tmp/js-interpreter-repos';
export const Repos = {
  CODE_DOT_ORG: {
    gitUrl: 'https://github.com/code-dot-org/JS-Interpreter.git',
    name: 'origin',
  },
  NeilFraser: {
    gitUrl: 'https://github.com/NeilFraser/JS-Interpreter.git',
    name: 'NeilFraser',
  },
};

@RPCInterface()
export default class SlaveVersionManager {
  repoConfig = Repos.CODE_DOT_ORG;

  getLocalRepoPath(repoConfig, extraPath) {
    const args = [REPO_ROOT, this.slaveId, repoConfig.name];
    if (extraPath) {
      args.push(extraPath);
    }
    return path.resolve(...args);
  }
}
